"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  uploadRaceAssets,
  type RaceAssetsActionState,
} from "@/app/race-assets/actions";

// ─── types ────────────────────────────────────────────────────────────────────

type RaceItem = { raceId: string };

type RaceAssetsUploadFormProps = {
  raceItems?: RaceItem[];
  fixedRaceId?: string;
};

type GpxInfo = {
  fileName: string;
  pointCount: number;
};

type ImageInfo = {
  fileName: string;
  previewUrl: string;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const EPSILON_LABELS: Record<number, string> = {
  0: "None",
  2: "2 m",
  5: "5 m",
  10: "10 m",
  20: "20 m",
  50: "50 m",
  100: "100 m",
};
const EPSILON_VALUES = [0, 2, 5, 10, 20, 50, 100];
const DEFAULT_EPSILON = 10;

function countGpxPoints(text: string): number {
  return (text.match(/<trkpt\b/gi) ?? []).length;
}

// ─── sub-components ───────────────────────────────────────────────────────────

type DropZoneProps = {
  id: string;
  label: string;
  hint: string;
  accept: string;
  name: string;
  fileName?: string;
  disabled?: boolean;
  onChange: (file: File | null) => void;
  children?: React.ReactNode;
};

function DropZone({
  id,
  label,
  hint,
  accept,
  name,
  fileName,
  disabled,
  onChange,
  children,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0] ?? null;
      if (file && inputRef.current) {
        // Sync the hidden input so it serialises with the form
        const dt = new DataTransfer();
        dt.items.add(file);
        inputRef.current.files = dt.files;
      }
      onChange(file);
    },
    [disabled, onChange],
  );

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-stone-800">
        {label}
      </label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          "relative flex min-h-[9rem] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-6 text-center transition",
          dragging
            ? "border-amber-500 bg-amber-50/60"
            : "border-stone-300 bg-stone-50/60 hover:border-stone-400 hover:bg-stone-50",
          disabled ? "pointer-events-none opacity-50" : "",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="file"
          accept={accept}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />

        {fileName ? (
          <div className="flex flex-col items-center gap-1">
            <FileIcon />
            <p className="text-sm font-medium text-stone-800 break-all">{fileName}</p>
            <p className="text-xs text-stone-400">Click or drag to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-stone-500">
            <UploadIcon />
            <p className="text-sm font-medium">{hint}</p>
            <p className="text-xs text-stone-400">Drag & drop or click to browse</p>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      aria-hidden
      className="h-8 w-8 text-stone-400"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      aria-hidden
      className="h-8 w-8 text-amber-600"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

// ─── main form ────────────────────────────────────────────────────────────────

const initialState: RaceAssetsActionState = { status: "idle" };

export function RaceAssetsUploadForm({ raceItems = [], fixedRaceId }: RaceAssetsUploadFormProps) {
  const [state, formAction, isPending] = useActionState(
    uploadRaceAssets,
    initialState,
  );

  const [raceId, setRaceId] = useState(fixedRaceId ?? "");
  const [epsilon, setEpsilon] = useState(DEFAULT_EPSILON);
  const [gpxInfo, setGpxInfo] = useState<GpxInfo | null>(null);
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const prevImageUrlRef = useRef<string | null>(null);

  // Revoke old object URL when imageInfo changes
  useEffect(() => {
    if (prevImageUrlRef.current) {
      URL.revokeObjectURL(prevImageUrlRef.current);
    }
    prevImageUrlRef.current = imageInfo?.previewUrl ?? null;
    return () => {
      if (prevImageUrlRef.current) {
        URL.revokeObjectURL(prevImageUrlRef.current);
      }
    };
  }, [imageInfo]);

  const handleGpxChange = useCallback((file: File | null) => {
    if (!file) {
      setGpxInfo(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        setGpxInfo({ fileName: file.name, pointCount: countGpxPoints(text) });
      }
    };
    reader.readAsText(file);
  }, []);

  const handleImageChange = useCallback((file: File | null) => {
    if (!file) {
      setImageInfo(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageInfo({ fileName: file.name, previewUrl: url });
  }, []);

  const hasFiles = !!gpxInfo || !!imageInfo;

  return (
    <form action={formAction} className="space-y-6">
      {/* ── Race ID ─────────────────────────────────────────── */}
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-xl text-stone-900">
          Race
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Files will be committed to <code>races/&lt;id&gt;/</code> in the
          content repository.
        </p>

        <div className="mt-5 space-y-2">
          {fixedRaceId ? (
            <>
              <input type="hidden" name="raceId" value={fixedRaceId} />
              <p className="text-sm font-semibold text-stone-800">Race ID</p>
              <p className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 max-w-xs">
                {fixedRaceId}
              </p>
            </>
          ) : (
            <>
              {raceItems.length > 0 ? (
                <>
                  <label
                    htmlFor="raceId-select"
                    className="block text-sm font-semibold text-stone-800"
                  >
                    Race ID
                  </label>
                  <select
                    id="raceId-select"
                    name="raceId"
                    value={raceId}
                    onChange={(e) => setRaceId(e.target.value)}
                    required
                    className="w-full max-w-xs rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  >
                    <option value="">— choose a race —</option>
                    {raceItems.map((r) => (
                      <option key={r.raceId} value={r.raceId}>
                        {r.raceId}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-stone-400 pt-1">
                    Or enter a new ID directly:
                  </p>
                </>
              ) : null}

              <label
                htmlFor="raceId-input"
                className={[
                  "block text-sm font-semibold text-stone-800",
                  raceItems.length > 0 ? "sr-only" : "",
                ].join(" ")}
              >
                Race ID
              </label>
              <input
                id="raceId-input"
                type="text"
                name={raceItems.length > 0 ? "_raceIdFreeText" : "raceId"}
                value={raceId}
                onChange={(e) => setRaceId(e.target.value)}
                placeholder="e.g. ben-nevis"
                pattern="[A-Za-z0-9\-]{2,80}"
                title="2–80 characters: letters, numbers, and hyphens only"
                className="w-full max-w-xs rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
              {raceItems.length > 0 && raceId ? (
                // Hidden field used when user types a free-text ID alongside the select
                <input type="hidden" name="raceId" value={raceId} />
              ) : null}
            </>
          )}
        </div>
      </section>

      {/* ── Map image ───────────────────────────────────────── */}
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-xl text-stone-900">
          Map image
          <span className="ml-2 text-sm font-normal text-stone-400">optional</span>
        </h2>
        <p className="mt-1 mb-5 text-sm text-stone-500">
          JPG, PNG, WebP, or SVG. Max 10 MB. Saved as{" "}
          <code>races/&lt;id&gt;/map.*</code>.
        </p>

        <DropZone
          id="imageFile"
          name="imageFile"
          label="Map image file"
          hint="Drop your map image here"
          accept=".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml"
          fileName={imageInfo?.fileName}
          onChange={handleImageChange}
        >
          {imageInfo && (
            <div className="mt-3 overflow-hidden rounded-xl border border-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageInfo.previewUrl}
                alt="Map preview"
                className="max-h-64 w-full object-contain bg-stone-100"
              />
            </div>
          )}
        </DropZone>
      </section>

      {/* ── GPX route ───────────────────────────────────────── */}
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-xl text-stone-900">
          GPX route file
          <span className="ml-2 text-sm font-normal text-stone-400">optional</span>
        </h2>
        <p className="mt-1 mb-5 text-sm text-stone-500">
          Max 5 MB. The file will be stripped of timestamps and device metadata,
          then track points will be smoothed. Saved as{" "}
          <code>races/&lt;id&gt;/route.gpx</code>.
        </p>

        <DropZone
          id="gpxFile"
          name="gpxFile"
          label="GPX file"
          hint="Drop your .gpx file here"
          accept=".gpx,application/gpx+xml,application/xml"
          fileName={gpxInfo?.fileName}
          onChange={handleGpxChange}
        >
          {gpxInfo && (
            <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
              <p className="font-semibold text-stone-800">
                {gpxInfo.pointCount.toLocaleString()} track points loaded
              </p>
              <p className="text-stone-500 text-xs mt-0.5">
                Smoothing will reduce this further depending on the tolerance
                chosen below.
              </p>
            </div>
          )}
        </DropZone>

        {/* Smoothing tolerance */}
        <div className="mt-6 space-y-3">
          <div className="flex items-baseline justify-between">
            <label
              htmlFor="epsilon"
              className="text-sm font-semibold text-stone-800"
            >
              Smoothing tolerance
            </label>
            <span className="text-sm font-medium text-amber-700 tabular-nums">
              {EPSILON_LABELS[epsilon] ?? `${epsilon} m`}
            </span>
          </div>

          <input
            id="epsilon"
            name="epsilon"
            type="range"
            min={0}
            max={EPSILON_VALUES.length - 1}
            step={1}
            value={EPSILON_VALUES.indexOf(epsilon) === -1 ? 3 : EPSILON_VALUES.indexOf(epsilon)}
            onChange={(e) =>
              setEpsilon(EPSILON_VALUES[parseInt(e.target.value, 10)] ?? DEFAULT_EPSILON)
            }
            className="w-full accent-amber-600"
          />

          <div className="flex justify-between text-xs text-stone-400 select-none">
            {EPSILON_VALUES.map((v) => (
              <span key={v}>{v === 0 ? "Off" : `${v} m`}</span>
            ))}
          </div>

          <p className="text-xs text-stone-500 leading-relaxed">
            Douglas-Peucker algorithm. Higher values remove more points and
            produce a smoother, smaller file. 5–10 m is recommended for most
            hill races.
          </p>
        </div>
      </section>

      {/* ── Options ─────────────────────────────────────────── */}
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <h2 className="font-[family:var(--font-heading)] text-xl text-stone-900">
          Options
        </h2>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="autoMerge"
            className="mt-0.5 h-4 w-4 rounded accent-amber-600"
          />
          <span className="text-sm text-stone-700">
            <span className="font-semibold">Auto-merge</span> — add the{" "}
            <code>auto-merge</code> label to the PR so it merges automatically
            once checks pass.
          </span>
        </label>
      </section>

      {/* ── Status feedback ─────────────────────────────────── */}
      {state.status === "success" && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-6 py-4 text-sm">
          <p className="font-semibold text-green-800">{state.message}</p>
          {state.gpxSummary && (
            <p className="mt-1 text-green-700">{state.gpxSummary}</p>
          )}
          {state.prUrl && (
            <a
              href={state.prUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block font-medium text-green-800 underline underline-offset-2"
            >
              View PR #{state.prNumber} on GitHub →
            </a>
          )}
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm">
          <p className="font-semibold text-red-800">{state.message}</p>
        </div>
      )}

      {/* ── Submit ──────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending || !raceId.trim() || !hasFiles}
          className="rounded-full bg-amber-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "Uploading…" : "Upload to GitHub"}
        </button>
        {!raceId.trim() && (
          <p className="text-xs text-stone-400">Enter a race ID to continue.</p>
        )}
        {raceId.trim() && !hasFiles && (
          <p className="text-xs text-stone-400">
            Select at least one file to upload.
          </p>
        )}
      </div>
    </form>
  );
}
