"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Image from "next/image";
import { useActionState } from "react";
import {
  type AssetMetadataState,
  type UploadAssetsState,
} from "@/app/collections/actions";
import { toSafeUploadFilename } from "@/lib/upload-filename";

type SelectedPreview = { name: string; url: string };

type AssetManifestEditorFormProps = {
  uploadAction: (
    previousState: UploadAssetsState,
    formData: FormData
  ) => Promise<UploadAssetsState>;
  saveAction: (
    previousState: AssetMetadataState,
    formData: FormData
  ) => Promise<AssetMetadataState>;
  uploadPathPrefix: string;
  uploadHeading: string;
  uploadDescription: string;
  metadataHeading: string;
  metadataDescription: string;
  pathHelp: string;
  fileFieldLabel: string;
  fileAccept?: string;
  previewMode: "image" | "file-list";
  defaultTier: string;
  defaultTags: string;
  pathPlaceholder: string;
  currentCount?: number;
  loadError?: string | null;
  showTitleField?: boolean;
  showDescriptionField?: boolean;
  saveButtonLabel: string;
  savePendingLabel: string;
  uploadButtonLabel: string;
  uploadPendingLabel: string;
};

const initialUploadState: UploadAssetsState = { status: "idle" };
const initialMetadataState: AssetMetadataState = { status: "idle" };
export function AssetManifestEditorForm({
  uploadAction,
  saveAction,
  uploadPathPrefix,
  uploadHeading,
  uploadDescription,
  metadataHeading,
  metadataDescription,
  pathHelp,
  fileFieldLabel,
  fileAccept,
  previewMode,
  defaultTier,
  defaultTags,
  pathPlaceholder,
  currentCount,
  loadError,
  showTitleField = false,
  showDescriptionField = false,
  saveButtonLabel,
  savePendingLabel,
  uploadButtonLabel,
  uploadPendingLabel,
}: AssetManifestEditorFormProps) {
  const [uploadState, uploadFormAction, uploadPending] = useActionState(
    uploadAction,
    initialUploadState
  );
  const [metadataState, metadataFormAction, metadataPending] = useActionState(
    saveAction,
    initialMetadataState
  );
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
  const [selectedPreviews, setSelectedPreviews] = useState<SelectedPreview[]>([]);
  const [path, setPath] = useState("");

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) {
      setSelectedFileNames([]);
      setSelectedPreviews((current) => {
        for (const preview of current) {
          URL.revokeObjectURL(preview.url);
        }

        return [];
      });
      return;
    }

    const nextFiles = Array.from(files);
    setSelectedFileNames(nextFiles.map((file) => file.name));
    setSelectedPreviews((current) => {
      for (const preview of current) {
        URL.revokeObjectURL(preview.url);
      }

      if (previewMode !== "image") {
        return [];
      }

      return nextFiles
        .filter((file) => {
          const safeName = toSafeUploadFilename(file.name, "image");
          if (!safeName) {
            return false;
          }

          const extension = safeName.split(".").pop() ?? "";
          return extension === "jpg" || extension === "webp";
        })
        .map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
    });
  }

  const uploadedPaths = useMemo(
    () =>
      selectedFileNames
        .map((name) =>
          previewMode === "image"
            ? toSafeUploadFilename(name, "image")
            : toSafeUploadFilename(name, "any")
        )
        .filter((value): value is string => Boolean(value))
        .map((safeName) => `${uploadPathPrefix}/${safeName}`),
    [previewMode, selectedFileNames, uploadPathPrefix]
  );

  return (
    <div className="grid gap-6">
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-xl text-stone-900">
          {uploadHeading}
        </h2>
        <p className="mt-1 mb-5 text-sm text-stone-500">{uploadDescription}</p>

        <form action={uploadFormAction} className="grid gap-4">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-stone-800">{fileFieldLabel}</span>
            <input
              type="file"
              name="assetFiles"
              multiple
              accept={fileAccept}
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

          {previewMode === "image" && selectedPreviews.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {selectedPreviews.map((preview) => (
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

          {uploadedPaths.length > 0 ? (
            <div className="rounded-2xl border border-stone-900/10 bg-stone-50 p-3 text-sm text-stone-700">
              <p className="font-semibold text-stone-900">Planned upload paths</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {uploadedPaths.map((uploadedPath) => (
                  <button
                    key={uploadedPath}
                    type="button"
                    onClick={() => setPath(uploadedPath)}
                    className="rounded-full border border-stone-900/10 bg-white px-3 py-1.5 text-left text-xs text-stone-700 transition hover:border-stone-900/30 hover:bg-stone-100"
                  >
                    {uploadedPath}
                  </button>
                ))}
              </div>
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
                : previewMode === "image"
                  ? `Images are prepared automatically before they are saved to ${uploadPathPrefix}.`
                  : `Uploads land in ${uploadPathPrefix}.`}
            </p>
            <div className="flex flex-col items-end gap-3">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-stone-600">
                <input type="checkbox" name="autoMerge" className="h-4 w-4 accent-stone-700" />
                Skip review
              </label>
              <button
                type="submit"
                disabled={uploadPending}
                className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {uploadPending ? uploadPendingLabel : uploadButtonLabel}
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-[#172119] p-6 text-stone-50 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
        <h2 className="font-[family:var(--font-heading)] text-xl text-stone-50">
          {metadataHeading}
        </h2>
        <p className="mt-1 text-sm text-stone-300">{metadataDescription}</p>
        <p className="mt-2 mb-5 text-sm text-stone-400">{pathHelp}</p>

        {typeof currentCount === "number" ? (
          <p className="mb-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-200">
            Current entries: {currentCount}
          </p>
        ) : null}

        {loadError ? (
          <p className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
            {loadError}
          </p>
        ) : null}

        <form action={metadataFormAction} className="grid gap-4">
          <label className="block space-y-2">
            <span className="text-sm font-semibold uppercase tracking-[0.14em] text-lime-200/80">
              Path
            </span>
            <input
              name="path"
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder={pathPlaceholder}
              className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold uppercase tracking-[0.14em] text-lime-200/80">
              Tier
            </span>
            <input
              name="tier"
              defaultValue={defaultTier}
              className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold uppercase tracking-[0.14em] text-lime-200/80">
              Tags
            </span>
            <input
              name="tags"
              defaultValue={defaultTags}
              placeholder="portrait, committee, modern"
              className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
            />
          </label>

          {showTitleField ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold uppercase tracking-[0.14em] text-lime-200/80">
                Title
              </span>
              <input
                name="title"
                className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
              />
            </label>
          ) : null}

          {showDescriptionField ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold uppercase tracking-[0.14em] text-lime-200/80">
                Description
              </span>
              <textarea
                name="description"
                rows={3}
                className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-lime-200/60"
              />
            </label>
          ) : null}

          {metadataState.fieldErrors?.path?.map((error) => (
            <p key={error} className="text-sm text-red-300">
              {error}
            </p>
          ))}
          {metadataState.fieldErrors?.tier?.map((error) => (
            <p key={error} className="text-sm text-red-300">
              {error}
            </p>
          ))}
          {metadataState.fieldErrors?.tags?.map((error) => (
            <p key={error} className="text-sm text-red-300">
              {error}
            </p>
          ))}
          {metadataState.fieldErrors?.title?.map((error) => (
            <p key={error} className="text-sm text-red-300">
              {error}
            </p>
          ))}
          {metadataState.fieldErrors?.description?.map((error) => (
            <p key={error} className="text-sm text-red-300">
              {error}
            </p>
          ))}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm leading-6 text-stone-300">
              {metadataState.status === "success" || metadataState.status === "error"
                ? metadataState.message
                : "Checks run before your submission is sent."}
            </p>
            <div className="flex flex-col items-end gap-3">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-stone-400">
                <input type="checkbox" name="autoMerge" className="h-4 w-4 accent-lime-500" />
                Skip review
              </label>
              <button
                type="submit"
                disabled={metadataPending || Boolean(loadError)}
                className="rounded-full bg-lime-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-lime-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {metadataPending ? savePendingLabel : saveButtonLabel}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}