"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useActionState } from "react";
import {
  saveCollectionsYamlDraft,
  uploadPicturesDraft,
  type CollectionsYamlState,
  type UploadPicturesState,
} from "@/app/collections/actions";
import type { CollectionsEditorOption } from "@/lib/collections-yaml";

type CollectionsEditorFormProps = {
  collectionOptions: CollectionsEditorOption[];
  raceOptions: CollectionsEditorOption[];
  loadError?: string | null;
};

const initialUploadState: UploadPicturesState = { status: "idle" };
const initialYamlState: CollectionsYamlState = { status: "idle" };

type SelectedImagePreview = { name: string; url: string };

function toSafePictureFilename(originalName: string): string | null {
  const trimmed = String(originalName).trim();
  const sep = trimmed.lastIndexOf(".");
  if (sep <= 0 || sep === trimmed.length - 1) return null;

  const rawBase = trimmed.slice(0, sep);
  const rawExt = trimmed.slice(sep + 1).toLowerCase();
  if (!new Set(["jpg", "jpeg", "png", "webp", "gif"]).has(rawExt)) return null;

  const safeBase = rawBase
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .replace(/[-.]+$/, "");

  if (!safeBase || safeBase === "." || safeBase === "..") return null;
  return `${safeBase}.${rawExt}`;
}

export function CollectionsEditorForm({
  collectionOptions,
  raceOptions,
  loadError,
}: CollectionsEditorFormProps) {
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadPicturesDraft,
    initialUploadState,
  );
  const [yamlState, yamlAction, yamlPending] = useActionState(
    saveCollectionsYamlDraft,
    initialYamlState,
  );
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
  const [selectedImagePreviews, setSelectedImagePreviews] = useState<
    SelectedImagePreview[]
  >([]);
  const [heroImagePath, setHeroImagePath] = useState("");
  const [singleImagePath, setSingleImagePath] = useState("");
  const [targetSection, setTargetSection] = useState("race");
  const [raceSlug, setRaceSlug] = useState(raceOptions[0]?.value ?? "");

  const isRaceTarget = targetSection === "race";
  const selectedCollection = useMemo(
    () => collectionOptions.find((o) => o.value === targetSection),
    [collectionOptions, targetSection],
  );

  const uploadedImagePaths = useMemo(
    () =>
      selectedFileNames
        .map(toSafePictureFilename)
        .filter((v): v is string => !!v)
        .map((name) => `blobs/${name}`),
    [selectedFileNames],
  );

  // Derive effective single path: keep user's selection if still valid, else first path
  const effectiveSingleImagePath = uploadedImagePaths.includes(singleImagePath)
    ? singleImagePath
    : (uploadedImagePaths[0] ?? "");

  const selectedHeroImagePath = uploadedImagePaths.includes(heroImagePath)
    ? heroImagePath
    : "";

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

  return (
    <div className="grid gap-6">
      {/* ── Upload to blobs/ ──────────────────────────────── */}
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
            Upload images to blobs/
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            Select one or more images and open a PR that adds them to the blobs/
            folder in the content repository.
          </p>
        </div>

        <form action={uploadAction} className="grid gap-4">
          <label className="block space-y-2">
            <span className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
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
          ) : (
            <p className="text-sm text-stone-600">No files selected yet.</p>
          )}

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

          {uploadState.fieldErrors?.imageFiles?.map((error) => (
            <p key={error} className="text-sm text-red-700">
              {error}
            </p>
          ))}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm leading-6 text-stone-700">
              {uploadState.message ??
                "Accepted formats: JPG, PNG, WEBP, GIF. Max 20 files, 10MB each."}
            </p>
            <div className="flex flex-col items-end gap-3">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-stone-600">
                <input
                  type="checkbox"
                  name="autoMerge"
                  className="h-4 w-4 accent-stone-700"
                />
                Minor correction — auto-merge
              </label>
              <button
                type="submit"
                disabled={uploadPending}
                className="rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
              >
                {uploadPending ? "Uploading…" : "Create pictures upload PR"}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* ── Edit collections.yaml ─────────────────────────── */}
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-[#172119] p-6 text-stone-50 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
            Edit collections.yaml
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-200">
            Register the uploaded images in collections.yaml. Select the target
            section and fill in only the required fields.
          </p>
          {loadError ? (
            <p className="mt-2 text-sm leading-6 text-amber-200">{loadError}</p>
          ) : null}
        </div>

        <form action={yamlAction} className="grid gap-4">
          <label className="block space-y-2">
            <span className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
              Target section
            </span>
            <select
              name="targetSection"
              value={targetSection}
              onChange={(e) => setTargetSection(e.target.value)}
              className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
            >
              <option value="race">Race image</option>
              {collectionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {yamlState.fieldErrors?.targetSection?.map((error) => (
            <p key={error} className="text-sm text-red-200">
              {error}
            </p>
          ))}

          {isRaceTarget ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
                Race
              </span>
              <select
                name="raceSlug"
                value={raceSlug}
                onChange={(e) => setRaceSlug(e.target.value)}
                className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
              >
                {raceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {yamlState.fieldErrors?.raceSlug?.map((error) => (
            <p key={error} className="text-sm text-red-200">
              {error}
            </p>
          ))}

          {/* Image paths — derived from selected uploads only */}
          {isRaceTarget ? (
            <>
              {uploadedImagePaths.length > 0 ? (
                <div className="rounded-2xl border border-lime-200/20 bg-black/25 p-3 text-sm text-stone-200">
                  <p className="font-semibold text-lime-100">Images to register</p>
                  <ul className="mt-2 space-y-1">
                    {uploadedImagePaths.map((path) => (
                      <li key={path}>{path}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-stone-400">
                  Select files above to populate image paths.
                </p>
              )}

              <input
                type="hidden"
                name="imagePaths"
                value={uploadedImagePaths.join("\n")}
                readOnly
              />
              <input type="hidden" name="imagePath" value="" readOnly />

              <label className="block space-y-2">
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
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
                  {uploadedImagePaths.map((path) => (
                    <option key={path} value={path}>
                      {path}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
                  Confidence{" "}
                  <span className="font-normal text-stone-400">(optional)</span>
                </span>
                <input
                  name="confidence"
                  placeholder="high (default)"
                  className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
                  Source{" "}
                  <span className="font-normal text-stone-400">(optional)</span>
                </span>
                <input
                  name="source"
                  placeholder="Defaults to your name/email"
                  className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
                />
              </label>

              <p className="text-sm leading-6 text-stone-300">
                Select one race, then submit all image paths together. A race can
                have one hero image total, and any number of gallery images.
              </p>
            </>
          ) : (
            <>
              {uploadedImagePaths.length > 1 ? (
                <label className="block space-y-2">
                  <span className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
                    Image path
                  </span>
                  <select
                    name="imagePath"
                    value={effectiveSingleImagePath}
                    onChange={(e) => setSingleImagePath(e.target.value)}
                    className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
                  >
                    {uploadedImagePaths.map((path) => (
                      <option key={path} value={path}>
                        {path}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <div className="rounded-2xl border border-lime-200/20 bg-black/25 p-3 text-sm text-stone-200">
                    <p className="font-semibold text-lime-100">Image path</p>
                    <p className="mt-1">
                      {uploadedImagePaths[0] ?? (
                        <span className="text-stone-400">
                          Select a file above to populate.
                        </span>
                      )}
                    </p>
                  </div>
                  <input
                    type="hidden"
                    name="imagePath"
                    value={effectiveSingleImagePath}
                    readOnly
                  />
                </>
              )}

              <label className="block space-y-2">
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
                  Tier
                </span>
                <select
                  name="tier"
                  className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
                >
                  <option value="strong">Strong</option>
                  <option value="mosaic-only">Mosaic only</option>
                  <option value="profile">Profile</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
                  Tags <span className="text-red-400">*</span>
                </span>
                <input
                  name="tags"
                  placeholder="comma,separated,tags (required)"
                  required
                  className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
                />
              </label>
            </>
          )}

          <input
            type="hidden"
            name="raceSlug"
            value={isRaceTarget ? raceSlug : ""}
            readOnly
          />

          {yamlState.fieldErrors?.imagePath?.map((error) => (
            <p key={error} className="text-sm text-red-200">
              {error}
            </p>
          ))}
          {yamlState.fieldErrors?.imagePaths?.map((error) => (
            <p key={error} className="text-sm text-red-200">
              {error}
            </p>
          ))}
          {yamlState.fieldErrors?.heroImagePath?.map((error) => (
            <p key={error} className="text-sm text-red-200">
              {error}
            </p>
          ))}
          {yamlState.fieldErrors?.tier?.map((error) => (
            <p key={error} className="text-sm text-red-200">
              {error}
            </p>
          ))}
          {yamlState.fieldErrors?.tags?.map((error) => (
            <p key={error} className="text-sm text-red-200">
              {error}
            </p>
          ))}

          {!isRaceTarget && selectedCollection ? (
            <p className="text-sm leading-6 text-stone-300">
              Adding an image item to {selectedCollection.label}.
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm leading-6 text-stone-200">
              {yamlState.message ??
                "Validation checks full collections.yaml structure before opening a pull request."}
            </p>
            <div className="flex flex-col items-end gap-3">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-stone-300">
                <input
                  type="checkbox"
                  name="autoMerge"
                  className="h-4 w-4 accent-lime-400"
                />
                Minor correction — auto-merge
              </label>
              <button
                type="submit"
                disabled={yamlPending || uploadedImagePaths.length === 0}
                className="rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-stone-500"
              >
                {yamlPending ? "Validating…" : "Create collections.yaml PR"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
