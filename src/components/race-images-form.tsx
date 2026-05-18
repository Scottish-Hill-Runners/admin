"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useActionState } from "react";
import {
  submitRaceImagesDraft,
  type RaceImagesSubmitState,
} from "@/app/collections/actions";
import { RACE_IMAGE_LICENSES, type RaceImageLicenseId } from "@/lib/race-image-licenses";

type ImageCard = {
  file: File;
  previewUrl: string;
  caption: string;
  year: string;
  tags: string;
  licenseId: RaceImageLicenseId | "";
  copyrightConfirmed: boolean;
  individualsDepicted: boolean;
  individualsConsent: boolean;
};

type RaceImagesFormProps = {
  fixedRaceSlug: string;
  raceExists: boolean;
  currentImageCount?: number;
};

const initialState: RaceImagesSubmitState = { status: "idle" };

export function RaceImagesForm({
  fixedRaceSlug,
  raceExists,
  currentImageCount,
}: RaceImagesFormProps) {
  const [state, formAction, isPending] = useActionState(submitRaceImagesDraft, initialState);
  const [cards, setCards] = useState<ImageCard[]>([]);
  const [heroIndex, setHeroIndex] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      for (const card of cards) URL.revokeObjectURL(card.previewUrl);
    };
  }, [cards]);

  function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setCards((prev) => {
      for (const card of prev) URL.revokeObjectURL(card.previewUrl);
      return files.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        caption: "",
        year: String(new Date().getFullYear()),
        tags: "",
        licenseId: "",
        copyrightConfirmed: false,
        individualsDepicted: false,
        individualsConsent: false,
      }));
    });
    setHeroIndex(null);
  }

  function updateCard(index: number, update: Partial<ImageCard>) {
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, ...update } : c)));
  }

  const metadataPayload = useMemo(
    () =>
      JSON.stringify(
        cards.map((card) => ({
          caption: card.caption.trim() || undefined,
          year: card.year ? Number(card.year) : undefined,
          tags: card.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          license: card.licenseId || undefined,
          copyrightConfirmed: card.copyrightConfirmed,
          individualsConsent: card.individualsDepicted ? card.individualsConsent : false,
        }))
      ),
    [cards]
  );

  const hasBlockingErrors =
    cards.length === 0 ||
    cards.some((c) => !c.copyrightConfirmed) ||
    cards.some((c) => c.individualsDepicted && !c.individualsConsent) ||
    cards.some((c) => !c.licenseId);

  return (
    <form action={formAction} className="grid gap-6">
      <input type="hidden" name="raceId" value={fixedRaceSlug} />
      <input type="hidden" name="imagesMetadata" value={metadataPayload} readOnly />
      <input
        type="hidden"
        name="heroIndex"
        value={heroIndex !== null ? String(heroIndex) : ""}
        readOnly
      />

      {/* ── File picker ──────────────────────────────────── */}
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-xl text-stone-900">
          Upload images
        </h2>
        <p className="mt-1 mb-5 text-sm text-stone-500">
          Select up to 20 images to add to this race. Accepted formats: JPG, PNG, WEBP,
          GIF. Max 10 MB each. Images are automatically resized and compressed for web
          delivery.
        </p>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-stone-800">Image files</span>
          <input
            type="file"
            name="imageFiles"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFilesChange}
            className="w-full rounded-2xl border border-dashed border-stone-900/20 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none transition focus:border-stone-900/40"
          />
        </label>
        {state.fieldErrors?.imageFiles?.map((error) => (
          <p key={error} className="mt-2 text-sm text-red-700">
            {error}
          </p>
        ))}
      </section>

      {/* ── Per-image metadata cards ─────────────────────── */}
      {cards.map((card, index) => {
        const selectedLicense = RACE_IMAGE_LICENSES.find((l) => l.id === card.licenseId);
        return (
          <section
            key={index}
            className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-5 shadow-[0_18px_40px_rgba(47,39,29,0.08)]"
          >
            <div className="flex gap-4">
              {/* Thumbnail */}
              <div className="shrink-0">
                <Image
                  src={card.previewUrl}
                  alt={card.file.name}
                  width={120}
                  height={90}
                  unoptimized
                  className="h-[90px] w-[120px] rounded-xl object-cover"
                />
              </div>

              {/* Fields */}
              <div className="min-w-0 flex-1 grid gap-3">
                {/* Caption */}
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-stone-800">Caption</span>
                  <input
                    type="text"
                    value={card.caption}
                    onChange={(e) => updateCard(index, { caption: e.target.value })}
                    placeholder="Describe the scene"
                    maxLength={300}
                    className="w-full rounded-xl border border-stone-900/15 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-stone-900/40"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Year */}
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold text-stone-800">Year</span>
                    <input
                      type="number"
                      value={card.year}
                      onChange={(e) => updateCard(index, { year: e.target.value })}
                      min={1900}
                      max={2099}
                      className="w-full rounded-xl border border-stone-900/15 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-stone-900/40"
                    />
                  </label>

                  {/* Tags */}
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold text-stone-800">
                      Tags{" "}
                      <span className="font-normal text-stone-400">(comma-separated)</span>
                    </span>
                    <input
                      type="text"
                      value={card.tags}
                      onChange={(e) => updateCard(index, { tags: e.target.value })}
                      placeholder="e.g. summit, checkpoint 3"
                      className="w-full rounded-xl border border-stone-900/15 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-stone-900/40"
                    />
                  </label>
                </div>

                {/* Licence */}
                <div className="space-y-1">
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold text-stone-800">
                      Licence{" "}
                      <span className="font-normal text-red-600">*</span>
                    </span>
                    <select
                      value={card.licenseId}
                      onChange={(e) =>
                        updateCard(index, {
                          licenseId: e.target.value as RaceImageLicenseId | "",
                        })
                      }
                      className="w-full rounded-xl border border-stone-900/15 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-stone-900/40"
                    >
                      <option value="" disabled>
                        Select a licence…
                      </option>
                      {RACE_IMAGE_LICENSES.map((lic) => (
                        <option key={lic.id} value={lic.id}>
                          {lic.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedLicense && (
                    <p className="text-xs text-stone-500">
                      {selectedLicense.description}
                      {selectedLicense.url && (
                        <>
                          {" "}
                          <a
                            href={selectedLicense.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-2 hover:text-stone-700"
                          >
                            View licence
                          </a>
                        </>
                      )}
                      {selectedLicense.id === "LicenseRef-Permission" && (
                        <span className="mt-0.5 block text-amber-700">
                          Record whose permission was granted in the caption field.
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Hero toggle */}
                <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={heroIndex === index}
                    onChange={(e) => setHeroIndex(e.target.checked ? index : null)}
                    className="h-4 w-4 accent-stone-700"
                  />
                  Set as hero image
                </label>
              </div>
            </div>

            {/* Rights confirmation — below thumbnail row */}
            <div className="mt-4 grid gap-2 border-t border-stone-900/8 pt-4">
              <label className="flex cursor-pointer select-none items-start gap-2.5 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={card.copyrightConfirmed}
                  onChange={(e) => updateCard(index, { copyrightConfirmed: e.target.checked })}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-stone-700"
                />
                <span>
                  I own the rights to this image, or have the rights holder&apos;s
                  permission to use it on the website
                </span>
                {!card.copyrightConfirmed && (
                  <span className="ml-auto shrink-0 text-xs font-semibold text-red-600">
                    Required
                  </span>
                )}
              </label>

              <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={card.individualsDepicted}
                  onChange={(e) =>
                    updateCard(index, {
                      individualsDepicted: e.target.checked,
                      individualsConsent: e.target.checked ? card.individualsConsent : false,
                    })
                  }
                  className="h-4 w-4 shrink-0 accent-stone-700"
                />
                This image depicts identifiable individuals
              </label>

              {card.individualsDepicted && (
                <label className="flex cursor-pointer select-none items-start gap-2.5 pl-6 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={card.individualsConsent}
                    onChange={(e) => updateCard(index, { individualsConsent: e.target.checked })}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-stone-700"
                  />
                  <span>
                    I confirm the individuals pictured have given their consent to appear on
                    the website
                  </span>
                  {!card.individualsConsent && (
                    <span className="ml-auto shrink-0 text-xs font-semibold text-red-600">
                      Required
                    </span>
                  )}
                </label>
              )}
            </div>
          </section>
        );
      })}

      {/* ── Submit panel ─────────────────────────────────── */}
      <section className="rounded-[1.5rem] bg-[#172119] p-6 text-stone-100 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
        <div className="mb-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-lime-200/70">
            Race
          </p>
          <p className="font-medium text-stone-100">{fixedRaceSlug}</p>
          {typeof currentImageCount === "number" && (
            <p className="mt-1 text-sm text-stone-400">
              {currentImageCount} image{currentImageCount === 1 ? "" : "s"} already
              registered
            </p>
          )}
        </div>

        {!raceExists && (
          <p className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
            <strong>{fixedRaceSlug}</strong> does not have a race file in the content store
            yet. Create the race details before uploading images.
          </p>
        )}

        {state.fieldErrors?.raceId?.map((error) => (
          <p key={error} className="mb-2 text-sm text-red-300">
            {error}
          </p>
        ))}
        {state.fieldErrors?.imagesMetadata?.map((error) => (
          <p key={error} className="mb-2 text-sm text-red-300">
            {error}
          </p>
        ))}

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
            Check status
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-200">
            {state.status === "success" || state.status === "error"
              ? state.message
              : "Nothing submitted yet."}
          </p>
        </div>

        <div className="mt-6 flex flex-col items-end gap-3">
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-stone-400">
            <input type="checkbox" name="autoMerge" className="h-4 w-4 accent-lime-500" />
            Skip review
          </label>
          <button
            type="submit"
            disabled={isPending || hasBlockingErrors || !raceExists}
            className="rounded-full bg-lime-300 px-5 py-2.5 text-sm font-semibold text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "Saving…" : "Save draft"}
          </button>
        </div>
      </section>
    </form>
  );
}

