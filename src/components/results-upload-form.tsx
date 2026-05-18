"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  saveResultsDraft,
  type ResultsUploadState,
} from "@/app/races/results-actions";
import { validateRaceResultsCsv } from "@/lib/results-csv";

const LIVE_VALIDATION_DEBOUNCE_MS = 250;
const PREVIEW_ROW_LIMIT = 300;

const initialState: ResultsUploadState = {
  status: "idle",
};

type ResultsUploadFormProps = {
  initialValues?: {
    raceId: string;
    year: string;
    csvText: string;
  } | null;
  /** When provided, the race ID is fixed from the URL and the selector is hidden. */
  fixedRaceId?: string;
  /** When provided, the year is fixed from the URL and the input is hidden. */
  fixedYear?: string;
  raceItems?: Array<{ raceId: string }>;
  knownClubNames?: string[];
};

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function normalizeYearValue(value: string): string {
  return value.trim().replace(/\*+$/g, "");
}

function parseInitialYear(raw: string): { year: string; suffix: string; shortenedRoute: boolean } {
  const isShortenedRoute = raw.trim().endsWith("*");
  const noStar = raw.trim().replace(/\*+$/g, "");
  const match = noStar.match(/^(\d{4})(?:-([A-Za-z0-9]+))?$/);
  if (match) {
    return { year: match[1], suffix: match[2] ?? "", shortenedRoute: isShortenedRoute };
  }
  return { year: noStar, suffix: "", shortenedRoute: isShortenedRoute };
}

function buildEffectiveYear(year: string, suffix: string, shortenedRoute: boolean): string {
  const normalized = normalizeYearValue(year);
  if (!normalized) {
    return "";
  }
  const withSuffix = suffix ? `${normalized}-${suffix}` : normalized;
  return shortenedRoute ? `${withSuffix}*` : withSuffix;
}

function parsePreview(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [] as string[], rows: [] as string[][] };
  }

  const splitLine = (line: string) => line.split(",").map((value) => value.trim());

  return {
    headers: splitLine(lines[0]),
    rows: lines.slice(1).map(splitLine),
  };
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delayMs, value]);

  return debouncedValue;
}

export function ResultsUploadForm({ initialValues, fixedRaceId, fixedYear, raceItems = [], knownClubNames }: ResultsUploadFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(saveResultsDraft, initialState);
  const buttonLabel = isPending ? "Checking..." : "Save results draft";
  const currentYear = new Date().getFullYear().toString();
  const initialYear = fixedYear ?? initialValues?.year ?? currentYear;
  const { year: initialYearBase, suffix: initialYearSuffix, shortenedRoute: initialShortenedRoute } = parseInitialYear(initialYear);
  const [raceIdValue, setRaceIdValue] = useState(fixedRaceId ?? initialValues?.raceId ?? "");
  const [yearValue, setYearValue] = useState(initialYearBase);
  const [yearSuffix, setYearSuffix] = useState(initialYearSuffix);
  const [shortenedRoute, setShortenedRoute] = useState(initialShortenedRoute);
  const [csvTextValue, setCsvTextValue] = useState(
    normalizeLineEndings(initialValues?.csvText ?? "")
  );
  const [prepareNewsTemplate, setPrepareNewsTemplate] = useState(true);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const debouncedCsvTextValue = useDebouncedValue(csvTextValue, LIVE_VALIDATION_DEBOUNCE_MS);
  const preview = useMemo(() => parsePreview(debouncedCsvTextValue), [debouncedCsvTextValue]);
  const clubNameSet = useMemo(
    () => (knownClubNames ? new Set(knownClubNames) : undefined),
    [knownClubNames]
  );
  const liveIssues = useMemo(
    () => validateRaceResultsCsv(debouncedCsvTextValue, { knownClubNames: clubNameSet }),
    [debouncedCsvTextValue, clubNameSet]
  );
  const liveErrors = liveIssues.filter((issue) => issue.level === "error");
  const liveWarnings = liveIssues.filter((issue) => issue.level === "warning");
  const liveNotes = liveIssues.filter((issue) => issue.level === "note");
  const blockingErrorsExist = liveErrors.length > 0;
  const previewRows = useMemo(
    () => preview.rows.slice(0, PREVIEW_ROW_LIMIT),
    [preview.rows]
  );
  const errorRows = useMemo(() => {
    const rows = new Set<number>();

    for (const issue of liveErrors) {
      if (issue.row) {
        rows.add(issue.row);
      }
    }

    return rows;
  }, [liveErrors]);
  const warningRows = useMemo(() => {
    const rows = new Set<number>();

    for (const issue of liveWarnings) {
      if (issue.row) {
        rows.add(issue.row);
      }
    }

    return rows;
  }, [liveWarnings]);
  const noteRows = useMemo(() => {
    const rows = new Set<number>();
    for (const issue of liveNotes)
      if (issue.row)
        rows.add(issue.row);
    return rows;
  }, [liveNotes]);
  const rowMessages = useMemo(() => {
    const map = new Map<number, string[]>();

    for (const issue of liveIssues) {
      if (issue.row) {
        const existing = map.get(issue.row);
        if (existing) {
          existing.push(issue.message);
        } else {
          map.set(issue.row, [issue.message]);
        }
      }
    }

    return map;
  }, [liveIssues]);
  const effectiveYearValue = useMemo(
    () => buildEffectiveYear(yearValue, yearSuffix, shortenedRoute),
    [yearValue, yearSuffix, shortenedRoute]
  );

  useEffect(() => {
    if (state.status !== "success" || !state.redirectToNewsUrl) {
      return;
    }

    router.push(state.redirectToNewsUrl);
  }, [router, state.redirectToNewsUrl, state.status]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFileName(null);
      return;
    }

    const text = await file.text();
    setSelectedFileName(file.name);
    setCsvTextValue(normalizeLineEndings(text));

    if (!fixedYear && (!yearValue || yearValue === currentYear)) {
      const rawFromName = file.name.replace(/\.csv$/i, "").trim();
      const isShortenedRoute = rawFromName.endsWith("*");
      const noStar = rawFromName.replace(/\*+$/g, "");
      const match = noStar.match(/^(\d{4})(?:-([A-Za-z0-9]+))?$/);
      if (match) {
        setYearValue(match[1]);
        setYearSuffix(match[2] ?? "");
      } else {
        setYearValue(noStar || currentYear);
        setYearSuffix("");
      }
      setShortenedRoute(isShortenedRoute);
    }
  }

  return (
    <form
      action={formAction}
      className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"
      onInput={(event) => {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement;
        if (target.name === "resultsRaceId") {
          setRaceIdValue(target.value.trim() || "RaceId");
        }
      }}
    >
      <input type="hidden" name="csvText" value={csvTextValue} />
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <div className="grid gap-5">
          {fixedRaceId ? (
            <>
              <input type="hidden" name="resultsRaceId" value={fixedRaceId} />
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">Race ID</p>
                <p className="rounded-2xl border border-stone-900/10 bg-stone-100 px-4 py-3 text-base text-stone-900">{fixedRaceId}</p>
              </div>
            </>
          ) : (
            <label className="block space-y-2">
              <span className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
                Race ID
              </span>
              <select
                name="resultsRaceId"
                value={raceIdValue}
                onChange={(event) => setRaceIdValue(event.target.value)}
                className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-stone-900/40"
              >
                <option value="">Select a race...</option>
                {raceItems.map((item) => (
                  <option key={item.raceId} value={item.raceId}>
                    {item.raceId}
                  </option>
                ))}
              </select>
              {state.fieldErrors?.raceId?.map((error) => (
                <p key={error} className="text-sm text-red-700">
                  {error}
                </p>
              ))}
            </label>
          )}
          {fixedYear ? (
            <>
              <input type="hidden" name="resultsYear" value={effectiveYearValue} />
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">Year</p>
                <p className="rounded-2xl border border-stone-900/10 bg-stone-100 px-4 py-3 text-base text-stone-900">{effectiveYearValue}</p>
              </div>
            </>
          ) : (
            <>
              <input type="hidden" name="resultsYear" value={effectiveYearValue} />
              <label className="block space-y-2">
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
                  Year
                </span>
                <input
                  value={yearValue}
                  onChange={(event) => setYearValue(normalizeYearValue(event.target.value))}
                  placeholder={currentYear}
                  className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-stone-900/40"
                />
                {state.fieldErrors?.year?.map((error) => (
                  <p key={error} className="text-sm text-red-700">
                    {error}
                  </p>
                ))}
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
                  Number / variant{" "}
                  <span className="font-normal normal-case tracking-normal text-stone-400">(optional)</span>
                </span>
                <input
                  value={yearSuffix}
                  onChange={(event) =>
                    setYearSuffix(event.target.value.trim().replace(/[^A-Za-z0-9]/g, ""))
                  }
                  placeholder="e.g. 1, 2, s, w"
                  className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-stone-900/40"
                />
                <p className="text-sm leading-5 text-stone-500">
                  For races held multiple times per year — e.g. <strong>1</strong> or <strong>2</strong> for Krunce, <strong>s</strong> or <strong>w</strong> for summer/winter editions.
                </p>
              </label>
            </>
          )}
          <label className="flex items-start gap-3 rounded-xl border border-stone-900/10 bg-stone-50 px-4 py-3">
            <input
              type="checkbox"
              name="shortenedRoute"
              checked={shortenedRoute}
              onChange={(event) => setShortenedRoute(event.target.checked)}
              className="mt-1 size-4 rounded border-stone-400 text-stone-900 focus:ring-stone-500"
            />
            <span className="text-sm leading-6 text-stone-700">
              This race used a shortened route (adds * to the year, for example 2015*).
            </span>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
              CSV file
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="w-full rounded-2xl border border-dashed border-stone-900/20 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none transition focus:border-stone-900/40"
            />
            <p className="text-sm leading-6 text-stone-600">
              {selectedFileName
                ? `Loaded file: ${selectedFileName}`
                : "Upload a CSV file to populate the preview and checks."}
            </p>
          </label>
          <p className="text-sm leading-6 text-stone-600">
            The uploaded CSV is saved as `races/&lt;raceId&gt;/&lt;year&gt;.csv`.
            Use the preview and checks to confirm content before submitting a draft.
          </p>
          <label className="flex items-start gap-3 rounded-xl border border-stone-900/10 bg-stone-50 px-4 py-3">
            <input
              type="checkbox"
              name="prepareNewsTemplate"
              checked={prepareNewsTemplate}
              onChange={(event) => setPrepareNewsTemplate(event.target.checked)}
              className="mt-1 size-4 rounded border-stone-400 text-stone-900 focus:ring-stone-500"
            />
            <span className="text-sm leading-6 text-stone-700">
              After saving results, open a prefilled news draft template with winners (manual review and submit).
            </span>
          </label>
          {state.fieldErrors?.csvText?.map((error) => (
            <p key={error} className="text-sm text-red-700">
              {error}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-[#172119] p-6 text-stone-50 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
        <div className="mb-5 rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
            Draft summary
          </p>
          <p className="mt-3 text-sm leading-6 text-stone-200">
            Target path: <span className="font-semibold text-white">races/{raceIdValue || "<race>"}/{effectiveYearValue || "<year>"}.csv</span>
          </p>
          <p className="text-sm leading-6 text-stone-300">
            Checks: header checks, time format checks, and runner category checks
          </p>
          <p className="text-sm leading-6 text-stone-300">
            File format: raw CSV saved directly to the content store
          </p>
        </div>
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
                Check status
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-200">
                {state.message ?? "Nothing submitted yet."}
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-stone-300">
                <input type="checkbox" name="autoMerge" className="h-4 w-4 accent-lime-400" />
                Minor correction — skip review
              </label>
              <button
                type="submit"
                disabled={isPending || blockingErrorsExist}
                className="rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-stone-500"
              >
                {buttonLabel}
              </button>
            </div>
          </div>
          {blockingErrorsExist ? (
            <p className="text-sm leading-6 text-red-200">
              Fix blocking errors before saving this draft.
            </p>
          ) : null}

          {state.issues && state.issues.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
                CSV issues
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-200">
                {state.issues.slice(0, 12).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
              CSV preview
            </p>
            {preview.headers.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <div className="mb-3 flex flex-wrap gap-3 text-sm">
                  <span className="rounded-full bg-red-950/60 px-3 py-1 text-red-200">
                    Errors: {liveErrors.length}
                  </span>
                  <span className="rounded-full bg-amber-950/60 px-3 py-1 text-amber-200">
                    Warnings: {liveWarnings.length}
                  </span>
                </div>
                {liveErrors.length > 0 && errorRows.size === 0 ? (
                  <p className="mb-3 text-sm leading-6 text-red-200">
                    Current errors are not tied to individual rows (for example, header-level issues), so no rows are highlighted.
                  </p>
                ) : null}
                {liveWarnings.length > 0 && warningRows.size === 0 ? (
                  <p className="mb-3 text-sm leading-6 text-amber-200">
                    Current warnings are not tied to individual rows (for example, header-level issues), so no rows are highlighted.
                  </p>
                ) : null}
                <div className="max-h-[32rem] overflow-y-auto rounded-xl border border-white/10">
                  <table className="min-w-full border-collapse text-left text-sm text-stone-200">
                    <thead className="sticky top-0 bg-[#1f2b20]">
                      <tr>
                        {preview.headers.map((header) => (
                          <th key={header} className="border-b border-white/10 px-2 py-2 font-semibold text-lime-100">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIndex) => {
                        const rowNumber = rowIndex + 2;
                        const hasError = errorRows.has(rowNumber);
                        const hasWarning = !hasError && warningRows.has(rowNumber);
                        const hasNote = !hasError && !hasWarning && noteRows.has(rowNumber);
                        const tooltip = rowMessages.get(rowNumber)?.join("\n");

                        return (
                          <tr
                            key={`${rowIndex}-${row.join("|")}`}
                            title={tooltip}
                            style={
                              hasError
                                ? { backgroundColor: "rgba(185, 28, 28, 0.45)", cursor: "help" }
                                : hasWarning
                                  ? { backgroundColor: "rgba(180, 120, 0, 0.40)", cursor: "help" }
                                  : hasNote
                                    ? { backgroundColor: "rgba(0, 128, 128, 0.25)", cursor: "help" }
                                    : undefined
                            }
                          >
                            {preview.headers.map((header, columnIndex) => (
                              <td
                                key={`${header}-${columnIndex}`}
                                className={`border-b px-2 py-2 align-top ${
                                  hasError
                                    ? "border-red-300/25 text-red-50"
                                    : hasWarning
                                      ? "border-amber-300/25 text-amber-50"
                                      : "border-white/5"
                                }`}
                              >
                                {row[columnIndex] ?? ""}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-sm leading-6 text-stone-400">
                  {preview.rows.length > PREVIEW_ROW_LIMIT
                    ? `Showing first ${PREVIEW_ROW_LIMIT} of ${preview.rows.length} data rows.`
                    : `Showing all ${preview.rows.length} data rows.`}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-stone-400">
                Upload CSV content to preview headers and rows here.
              </p>
            )}
          </div>
        </div>
      </section>
    </form>
  );
}
