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

const initialUploadState: UploadPicturesState = {
  status: "idle",
};

const initialYamlState: CollectionsYamlState = {
  status: "idle",
};

type SelectedImagePreview = {
  name: string;
  url: string;
};

function toSafePictureFilename(originalName: string): string | null {
  const trimmed = String(originalName).trim();
  const extensionSeparator = trimmed.lastIndexOf(".");
  if (extensionSeparator <= 0 || extensionSeparator === trimmed.length - 1) {
    return null;
  }

  const rawBase = trimmed.slice(0, extensionSeparator);
  const rawExtension = trimmed.slice(extensionSeparator + 1).toLowerCase();
  const allowedImageExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  if (!allowedImageExtensions.has(rawExtension)) {
    return null;
  }

  const safeBase = rawBase
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .replace(/[-.]+$/, "");

  if (!safeBase || safeBase === "." || safeBase === "..") {
    return null;
  }

  return `${safeBase}.${rawExtension}`;
}

function splitImagePaths(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((path) => path.trim())
    .filter((path) => path.length > 0);
}

function toUniquePaths(paths: string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const path of paths) {
    if (seen.has(path)) {
      continue;
    }

    seen.add(path);
    unique.push(path);
  }

  return unique;
}

export function CollectionsEditorForm({
  collectionOptions,
  raceOptions,
  loadError,
}: CollectionsEditorFormProps) {
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadPicturesDraft,
    initialUploadState
  );
  const [yamlState, yamlAction, yamlPending] = useActionState(
    saveCollectionsYamlDraft,
    initialYamlState
  );
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
  const [selectedImagePreviews, setSelectedImagePreviews] = useState<SelectedImagePreview[]>([]);
  const [manualRaceImagePaths, setManualRaceImagePaths] = useState<string>("");
  const [heroImagePath, setHeroImagePath] = useState<string>("");
  const [targetSection, setTargetSection] = useState<string>(
    "race"
  );
  const [raceSlug, setRaceSlug] = useState<string>(raceOptions[0]?.value ?? "");

  const uploadButtonLabel = uploadPending
    ? "Uploading..."
    : "Create pictures upload PR";
  const yamlButtonLabel = yamlPending
    ? "Validating..."
    : "Create collections.yaml PR";
  const isRaceTarget = targetSection === "race";
  const selectedCollection = useMemo(
    () => collectionOptions.find((option) => option.value === targetSection),
    [collectionOptions, targetSection]
  );
  const uploadedImagePaths = useMemo(
    () =>
      selectedFileNames
        .map((name) => toSafePictureFilename(name))
        .filter((value): value is string => !!value)
        .map((safeName) => `blobs/${safeName}`),
    [selectedFileNames]
  );
  const raceImagePaths = useMemo(
    () => toUniquePaths(uploadedImagePaths.concat(splitImagePaths(manualRaceImagePaths))),
    [manualRaceImagePaths, uploadedImagePaths]
  );
  const raceImagePathsPayload = useMemo(
    () => raceImagePaths.join("\n"),
    [raceImagePaths]
  );
  const selectedHeroImagePath = raceImagePaths.includes(heroImagePath) ? heroImagePath : "";

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
      setSelectedImagePreviews((previousPreviews) => {
        for (const preview of previousPreviews) {
          URL.revokeObjectURL(preview.url);
        }

        return [];
      });
      return;
    }

    const nextFiles = Array.from(files);
    setSelectedFileNames(nextFiles.map((file) => file.name));
    setSelectedImagePreviews((previousPreviews) => {
      for (const preview of previousPreviews) {
        URL.revokeObjectURL(preview.url);
      }

      return nextFiles.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      }));
    });
  }

  return (
    <div className="grid gap-6">
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
                <input type="checkbox" name="autoMerge" className="h-4 w-4 accent-stone-700" />
                Minor correction — auto-merge
              </label>
              <button
                type="submit"
                disabled={uploadPending}
                className="rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
              >
                {uploadButtonLabel}
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-[#172119] p-6 text-stone-50 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
            Edit collections.yaml
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-200">
            Select homepage decorative, committee portraits, or race mappings and enter only
            the required fields.
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
              onChange={(event) => setTargetSection(event.target.value)}
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
                onChange={(event) => setRaceSlug(event.target.value)}
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

          {isRaceTarget ? (
            <>
              <label className="block space-y-2">
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
                  Image paths
                </span>
                <textarea
                  value={manualRaceImagePaths}
                  onChange={(event) => setManualRaceImagePaths(event.target.value)}
                  rows={5}
                  placeholder="Add manual paths, one per line, e.g. blobs/race-day-1.jpg"
                  className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
                />
              </label>

              {uploadedImagePaths.length > 0 ? (
                <div className="rounded-2xl border border-lime-200/20 bg-black/25 p-3 text-sm text-stone-200">
                  <p className="font-semibold text-lime-100">From selected uploads</p>
                  <ul className="mt-2 space-y-1">
                    {uploadedImagePaths.map((path) => (
                      <li key={path}>{path}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {raceImagePaths.length > 0 ? (
                <div className="rounded-2xl border border-lime-200/20 bg-black/25 p-3 text-sm text-stone-200">
                  <p className="font-semibold text-lime-100">
                    This submission will create one race entry per image
                  </p>
                  <ul className="mt-2 space-y-1">
                    {raceImagePaths.map((path) => (
                      <li key={path}>{path}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <input type="hidden" name="imagePaths" value={raceImagePathsPayload} readOnly />
              <input type="hidden" name="imagePath" value="" readOnly />

              <label className="block space-y-2">
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
                  Hero image (optional)
                </span>
                <select
                  name="heroImagePath"
                  value={selectedHeroImagePath}
                  onChange={(event) => setHeroImagePath(event.target.value)}
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

              <label className="block space-y-2">
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
                  Confidence (optional)
                </span>
                <input
                  name="confidence"
                  placeholder="high (default)"
                  className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
                  Source (optional)
                </span>
                <input
                  name="source"
                  placeholder="Defaults to your name/email"
                  className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
                />
              </label>

              <p className="text-sm leading-6 text-stone-300">
                Select one race once, then submit all image paths together. A race can have one
                hero image total, and any number of gallery images.
              </p>
            </>
          ) : (
            <>
              <label className="block space-y-2">
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
                  Image path
                </span>
                <input
                  name="imagePath"
                  placeholder="blobs/example.jpg"
                  className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
                />
              </label>

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

          <input type="hidden" name="raceSlug" value={isRaceTarget ? raceSlug : ""} readOnly />

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
          ) : (
            <p className="text-sm leading-6 text-stone-300">
              One collections.yaml entry is created for each submitted race image path.
            </p>
          )}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm leading-6 text-stone-200">
              {yamlState.message ??
                "Validation checks full collections.yaml structure before opening a pull request."}
            </p>
            <div className="flex flex-col items-end gap-3">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-stone-300">
                <input type="checkbox" name="autoMerge" className="h-4 w-4 accent-lime-400" />
                Minor correction — auto-merge
              </label>
              <button
                type="submit"
                disabled={yamlPending}
                className="rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-stone-500"
              >
                {yamlButtonLabel}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
