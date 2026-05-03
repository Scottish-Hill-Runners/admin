"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useActionState } from "react";
import {
  saveRaceImagesDraft,
  uploadRaceImagesDraft,
  type AssetMetadataState,
  type UploadAssetsState,
} from "@/app/collections/actions";
import { toSafeUploadFilename } from "@/lib/upload-filename";

type RaceImagesFormProps = {
  fixedRaceSlug: string;
  raceExists: boolean;
  currentImageCount?: number;
};

const initialUploadState: UploadAssetsState = { status: "idle" };
const initialYamlState: AssetMetadataState = { status: "idle" };

type SelectedImagePreview = { name: string; url: string };

function splitImagePaths(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function toUniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  return paths.filter((p) => (seen.has(p) ? false : (seen.add(p), true)));
}

export function RaceImagesForm({
  fixedRaceSlug,
  raceExists,
  currentImageCount,
}: RaceImagesFormProps) {
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadRaceImagesDraft,
    initialUploadState,
  );
  const [yamlState, yamlAction, yamlPending] = useActionState(
    saveRaceImagesDraft,
    initialYamlState,
  );
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
  const [selectedImagePreviews, setSelectedImagePreviews] = useState<
    SelectedImagePreview[]
  >([]);
  const [manualRaceImagePaths, setManualRaceImagePaths] = useState("");
  const [heroImagePath, setHeroImagePath] = useState("");

  useEffect(() => {
    return () => {
      for (const preview of selectedImagePreviews) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [selectedImagePreviews]);

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) {
      setSelectedFileNames([]);
      setSelectedImagePreviews((prev) => {
        for (const p of prev) URL.revokeObjectURL(p.url);
        return [];
      });
      return;
    }
    const next = Array.from(files);
    setSelectedFileNames(next.map((f) => f.name));
    setSelectedImagePreviews((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.url);
      return next.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
    });
  }

  const uploadedImagePaths = useMemo(
    () =>
      selectedFileNames
        .map((name) => toSafeUploadFilename(name, "image"))
        .filter((v): v is string => !!v)
        .map((name) => `blobs/races/${fixedRaceSlug}/${name}`),
    [fixedRaceSlug, selectedFileNames],
  );

  const raceImagePaths = useMemo(
    () =>
      toUniquePaths(
        uploadedImagePaths.concat(splitImagePaths(manualRaceImagePaths)),
      ),
    [manualRaceImagePaths, uploadedImagePaths],
  );

  const raceImagePathsPayload = raceImagePaths.join("\n");
  const selectedHeroImagePath = raceImagePaths.includes(heroImagePath)
    ? heroImagePath
    : "";

  return (
    <div className="grid gap-6">
      {/* ── Upload to blobs/ ──────────────────────────────── */}
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-xl text-stone-900">
          Upload images
        </h2>
        <p className="mt-1 mb-5 text-sm text-stone-500">
          Select one or more images to add to <code>{`blobs/races/${fixedRaceSlug}/`}</code>
          in the content store. Images are prepared automatically in the background
          to keep file sizes web-friendly. Accepted formats: JPG, PNG, WEBP, GIF.
          Max 20 files, 10 MB each.
        </p>

        <form action={uploadAction} className="grid gap-4">
          <input type="hidden" name="raceId" value={fixedRaceSlug} />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-stone-800">
              Image files
            </span>
            <input
              type="file"
              name="imageFiles"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFilesChange}
              className="w-full rounded-2xl border border-dashed border-stone-900/20 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none transition focus:border-stone-900/40"
            />
          </label>

          {selectedFileNames.length > 0 ? (
            <ul className="rounded-xl border border-stone-900/10 bg-stone-50 p-3 text-sm text-stone-700">
              {selectedFileNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          ) : null}

          {selectedImagePreviews.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {selectedImagePreviews.map((preview) => (
                <figure
                  key={preview.url}
                  className="overflow-hidden rounded-2xl border border-stone-900/10 bg-white"
                >
                  <Image
                    src={preview.url}
                    alt={preview.name}
                    width={320}
                    height={128}
                    unoptimized
                    className="h-32 w-full object-cover"
                  />
                  <figcaption className="truncate px-3 py-2 text-xs text-stone-700">
                    {preview.name}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}

          {uploadState.fieldErrors?.assetFiles?.map((error) => (
            <p key={error} className="text-sm text-red-700">
              {error}
            </p>
          ))}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm leading-6 text-stone-600">
              {uploadState.status === "success" || uploadState.status === "error"
                ? uploadState.message
                : null}
            </p>
            <div className="flex flex-col items-end gap-3">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-stone-600">
                <input
                  type="checkbox"
                  name="autoMerge"
                  className="h-4 w-4 accent-stone-700"
                />
                Publish automatically
              </label>
              <button
                type="submit"
                disabled={uploadPending}
                className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {uploadPending ? "Uploading…" : "Upload and save"}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* ── Register in races/<raceId>/images.yaml ───────── */}
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-[#172119] p-6 text-stone-50 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
        <h2 className="font-[family:var(--font-heading)] text-xl text-stone-50">
          Update image list
        </h2>
        <p className="mt-1 mb-5 text-sm text-stone-300">
          Add the uploaded image paths to the race image list.
          Use the paths shown above after uploading, or enter them manually.
        </p>

        {typeof currentImageCount === "number" ? (
          <p className="mb-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-200">
            Current images registered: {currentImageCount}
          </p>
        ) : null}

        {!raceExists ? (
          <p className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
            <strong>{fixedRaceSlug}</strong> does not have a race file in the
            content store yet. Create the race details first before
            registering images.
          </p>
        ) : null}

        <form action={yamlAction} className="grid gap-4">
          <input type="hidden" name="raceId" value={fixedRaceSlug} />

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lime-200/70 mb-1">
              Race
            </p>
            <p className="text-stone-100 font-medium">{fixedRaceSlug}</p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold uppercase tracking-[0.14em] text-lime-200/80">
              Image paths
            </span>
            <textarea
              value={manualRaceImagePaths}
              onChange={(e) => setManualRaceImagePaths(e.target.value)}
              rows={4}
              placeholder={`Add paths, one per line, e.g. blobs/races/${fixedRaceSlug}/summit-shot.jpg`}
              className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
            />
          </label>

          {uploadedImagePaths.length > 0 ? (
            <div className="rounded-2xl border border-lime-200/20 bg-black/25 p-3 text-sm text-stone-200">
              <p className="font-semibold text-lime-100">From selected uploads</p>
              <ul className="mt-2 space-y-1">
                {uploadedImagePaths.map((path) => (
                  <li key={path}>
                    <button
                      type="button"
                      onClick={() =>
                        setManualRaceImagePaths((current) =>
                          current.length > 0 ? `${current}\n${path}` : path
                        )
                      }
                      className="text-left hover:text-lime-100 hover:underline underline-offset-4"
                    >
                      {path}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {raceImagePaths.length > 0 ? (
            <div className="rounded-2xl border border-lime-200/20 bg-black/25 p-3 text-sm text-stone-200">
              <p className="font-semibold text-lime-100">Will register</p>
              <ul className="mt-2 space-y-1">
                {raceImagePaths.map((path) => (
                  <li key={path}>{path}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <input
            type="hidden"
            name="imagePaths"
            value={raceImagePathsPayload}
            readOnly
          />

          <label className="block space-y-2">
            <span className="text-sm font-semibold uppercase tracking-[0.14em] text-lime-200/80">
              Hero image{" "}
              <span className="font-normal text-stone-400">(optional)</span>
            </span>
            <select
              name="heroImagePath"
              value={selectedHeroImagePath}
              onChange={(e) => setHeroImagePath(e.target.value)}
              className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
            >
              <option value="">No hero in this submission (all gallery)</option>
              {raceImagePaths.map((path) => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
            </select>
          </label>

          {yamlState.fieldErrors?.imagePaths?.map((error) => (
            <p key={error} className="text-sm text-red-300">
              {error}
            </p>
          ))}
          {yamlState.fieldErrors?.heroImagePath?.map((error) => (
            <p key={error} className="text-sm text-red-300">
              {error}
            </p>
          ))}
          {yamlState.fieldErrors?.raceId?.map((error) => (
            <p key={error} className="text-sm text-red-300">
              {error}
            </p>
          ))}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm leading-6 text-stone-300">
              {yamlState.status === "success" || yamlState.status === "error"
                ? yamlState.message
                : "Checks run before this image list update is submitted."}
            </p>
            <div className="flex flex-col items-end gap-3">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-stone-400">
                <input
                  type="checkbox"
                  name="autoMerge"
                  className="h-4 w-4 accent-lime-500"
                />
                Publish automatically
              </label>
              <button
                type="submit"
                disabled={yamlPending || !raceExists || raceImagePaths.length === 0}
                className="rounded-full bg-lime-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-lime-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {yamlPending ? "Saving…" : "Save image list"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
