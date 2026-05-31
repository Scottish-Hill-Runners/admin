"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { RACE_IMAGE_LICENSES, type RaceImageLicenseId } from "@/lib/race-image-licenses";

type SharedImageUploadState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: {
    imageFiles?: string[];
    raceId?: string[];
    imagesMetadata?: string[];
  };
  redirectToWorkflowUrl?: string;
};

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

type SharedImageUploadFormProps = {
  action: (
    previousState: SharedImageUploadState,
    formData: FormData
  ) => Promise<SharedImageUploadState>;
  initialState: SharedImageUploadState;
  fixedIdentifier?: {
    fieldName: string;
    value: string;
    label: string;
  };
  returnToWorkflowUrl?: string;
  currentImageCount?: number;
  submitLabel?: string;
  pendingLabel?: string;
  uploadHeading: string;
  uploadDescription: string;
  includeCaptionYear?: boolean;
  showHeroOption?: boolean;
  assumedIndividualsDepicted?: boolean;
  allowIndividualsDepictedToggle?: boolean;
  showRaceMissingWarning?: boolean;
  canSubmit?: boolean;
  cannotSubmitMessage?: string;
};

export function SharedImageUploadForm({
  action,
  initialState,
  fixedIdentifier,
  returnToWorkflowUrl,
  currentImageCount,
  submitLabel = "Save draft",
  pendingLabel = "Saving…",
  uploadHeading,
  uploadDescription,
  includeCaptionYear = true,
  showHeroOption = false,
  assumedIndividualsDepicted,
  allowIndividualsDepictedToggle = true,
  showRaceMissingWarning = false,
  canSubmit = true,
  cannotSubmitMessage,
}: SharedImageUploadFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [cards, setCards] = useState<ImageCard[]>([]);
  const [heroIndex, setHeroIndex] = useState<number | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    if (state.status !== "success" || !state.redirectToWorkflowUrl) {
      return;
    }

    router.push(state.redirectToWorkflowUrl);
  }, [router, state.redirectToWorkflowUrl, state.status]);

  useEffect(() => {
    return () => {
      for (const card of cards) {
        URL.revokeObjectURL(card.previewUrl);
      }
    };
  }, [cards]);

  useEffect(() => {
    if (state.status === "success") {
      for (const card of cards) {
        URL.revokeObjectURL(card.previewUrl);
      }
      setCards([]);
      setHeroIndex(null);
      setFileInputKey((key) => key + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setCards((previous) => {
      for (const card of previous) {
        URL.revokeObjectURL(card.previewUrl);
      }

      return files.map((file) => {
        const individualsDepictedDefault =
          assumedIndividualsDepicted === undefined ? false : assumedIndividualsDepicted;
        return {
          file,
          previewUrl: URL.createObjectURL(file),
          caption: "",
          year: String(new Date().getFullYear()),
          tags: "",
          licenseId: "",
          copyrightConfirmed: false,
          individualsDepicted: individualsDepictedDefault,
          individualsConsent: false,
        };
      });
    });
    setHeroIndex(null);
  }

  function updateCard(index: number, update: Partial<ImageCard>) {
    setCards((previous) => previous.map((card, i) => (i === index ? { ...card, ...update } : card)));
  }

  const metadataPayload = useMemo(
    () =>
      JSON.stringify(
        cards.map((card) => ({
          caption: includeCaptionYear ? card.caption.trim() || undefined : undefined,
          year: includeCaptionYear && card.year ? Number(card.year) : undefined,
          tags: card.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          license: card.licenseId || undefined,
          copyrightConfirmed: card.copyrightConfirmed,
          individualsDepicted: card.individualsDepicted,
          individualsConsent: card.individualsDepicted ? card.individualsConsent : false,
        }))
      ),
    [cards, includeCaptionYear]
  );

  const hasBlockingErrors =
    cards.length === 0 ||
    cards.some((card) => !card.copyrightConfirmed) ||
    cards.some((card) => card.individualsDepicted && !card.individualsConsent) ||
    cards.some((card) => !card.licenseId);

  return (
    <form action={formAction} className="grid gap-6">
      {fixedIdentifier ? (
        <input type="hidden" name={fixedIdentifier.fieldName} value={fixedIdentifier.value} />
      ) : null}
      {returnToWorkflowUrl ? (
        <input type="hidden" name="returnToWorkflowUrl" value={returnToWorkflowUrl} />
      ) : null}
      <input type="hidden" name="imagesMetadata" value={metadataPayload} readOnly />
      {showHeroOption ? (
        <input
          type="hidden"
          name="heroIndex"
          value={heroIndex !== null ? String(heroIndex) : ""}
          readOnly
        />
      ) : null}

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-xl text-stone-900">{uploadHeading}</h2>
        <p className="mt-1 mb-5 text-sm text-stone-500">{uploadDescription}</p>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-stone-800">Image files</span>
          <input
            key={fileInputKey}
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

      {cards.map((card, index) => {
        const selectedLicense = RACE_IMAGE_LICENSES.find((license) => license.id === card.licenseId);
        const showIndividualsToggle = allowIndividualsDepictedToggle;
        return (
          <section
            key={index}
            className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-5 shadow-[0_18px_40px_rgba(47,39,29,0.08)]"
          >
            <div className="flex gap-4">
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

              <div className="min-w-0 flex-1 grid gap-3">
                {includeCaptionYear ? (
                  <>
                    <label className="block space-y-1">
                      <span className="text-sm font-semibold text-stone-800">Caption</span>
                      <input
                        type="text"
                        value={card.caption}
                        onChange={(event) => updateCard(index, { caption: event.target.value })}
                        placeholder="Describe the scene"
                        maxLength={300}
                        className="w-full rounded-xl border border-stone-900/15 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-stone-900/40"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-sm font-semibold text-stone-800">Year</span>
                      <input
                        type="number"
                        value={card.year}
                        onChange={(event) => updateCard(index, { year: event.target.value })}
                        min={1900}
                        max={2099}
                        className="w-full rounded-xl border border-stone-900/15 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-stone-900/40"
                      />
                    </label>
                  </>
                ) : null}

                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-stone-800">
                    Tags <span className="font-normal text-stone-400">(comma-separated)</span>
                  </span>
                  <input
                    type="text"
                    value={card.tags}
                    onChange={(event) => updateCard(index, { tags: event.target.value })}
                    placeholder="e.g. summit, checkpoint 3"
                    className="w-full rounded-xl border border-stone-900/15 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-stone-900/40"
                  />
                </label>

                <div className="space-y-1">
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold text-stone-800">
                      Licence <span className="font-normal text-red-600">*</span>
                    </span>
                    <select
                      value={card.licenseId}
                      onChange={(event) =>
                        updateCard(index, {
                          licenseId: event.target.value as RaceImageLicenseId | "",
                        })
                      }
                      className="w-full rounded-xl border border-stone-900/15 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-stone-900/40"
                    >
                      <option value="" disabled>
                        Select a licence…
                      </option>
                      {RACE_IMAGE_LICENSES.map((license) => (
                        <option key={license.id} value={license.id}>
                          {license.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedLicense ? (
                    <p className="text-xs text-stone-500">
                      {selectedLicense.description}
                      {selectedLicense.url ? (
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
                      ) : null}
                    </p>
                  ) : null}
                </div>

                {showHeroOption ? (
                  <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={heroIndex === index}
                      onChange={(event) => setHeroIndex(event.target.checked ? index : null)}
                      className="h-4 w-4 accent-stone-700"
                    />
                    Set as hero image
                  </label>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-2 border-t border-stone-900/8 pt-4">
              <label className="flex cursor-pointer select-none items-start gap-2.5 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={card.copyrightConfirmed}
                  onChange={(event) =>
                    updateCard(index, { copyrightConfirmed: event.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 accent-stone-700"
                />
                <span>
                  I own the rights to this image, or have the rights holder&apos;s permission
                  to use it on the website
                </span>
                {!card.copyrightConfirmed ? (
                  <span className="ml-auto shrink-0 text-xs font-semibold text-red-600">
                    Required
                  </span>
                ) : null}
              </label>

              {showIndividualsToggle ? (
                <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={card.individualsDepicted}
                    onChange={(event) =>
                      updateCard(index, {
                        individualsDepicted: event.target.checked,
                        individualsConsent: event.target.checked ? card.individualsConsent : false,
                      })
                    }
                    className="h-4 w-4 shrink-0 accent-stone-700"
                  />
                  This image depicts identifiable individuals
                </label>
              ) : (
                <p className="text-sm text-stone-700">This image depicts identifiable individuals.</p>
              )}

              {card.individualsDepicted ? (
                <label className="flex cursor-pointer select-none items-start gap-2.5 pl-6 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={card.individualsConsent}
                    onChange={(event) =>
                      updateCard(index, { individualsConsent: event.target.checked })
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 accent-stone-700"
                  />
                  <span>
                    I confirm the individuals pictured have given their consent to appear on
                    the website
                  </span>
                  {!card.individualsConsent ? (
                    <span className="ml-auto shrink-0 text-xs font-semibold text-red-600">
                      Required
                    </span>
                  ) : null}
                </label>
              ) : null}
            </div>
          </section>
        );
      })}

      <section className="rounded-[1.5rem] bg-[#172119] p-6 text-stone-100 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
        {fixedIdentifier ? (
          <div className="mb-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-lime-200/70">
              {fixedIdentifier.label}
            </p>
            <p className="font-medium text-stone-100">{fixedIdentifier.value}</p>
            {typeof currentImageCount === "number" ? (
              <p className="mt-1 text-sm text-stone-400">
                {currentImageCount} image{currentImageCount === 1 ? "" : "s"} already registered
              </p>
            ) : null}
          </div>
        ) : null}

        {showRaceMissingWarning && !canSubmit && cannotSubmitMessage ? (
          <p className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
            {cannotSubmitMessage}
          </p>
        ) : null}

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
            disabled={isPending || hasBlockingErrors || !canSubmit}
            className="rounded-full bg-lime-300 px-5 py-2.5 text-sm font-semibold text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? pendingLabel : submitLabel}
          </button>
        </div>
      </section>
    </form>
  );
}