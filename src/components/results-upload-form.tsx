"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
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

type InputProps = {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  errors?: string[];
};

type ResultsUploadFormProps = {
  initialValues?: {
    raceId: string;
    year: string;
    csvText: string;
  } | null;
  raceItems?: Array<{ raceId: string }>;
};

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
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

function InputField({ label, name, placeholder, defaultValue, errors }: InputProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
        {label}
      </span>
      <input
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-stone-900/40"
      />
      {errors?.map((error) => (
        <p key={error} className="text-sm text-red-700">
          {error}
        </p>
      ))}
    </label>
  );
}

export function ResultsUploadForm({ initialValues, raceItems = [] }: ResultsUploadFormProps) {
  const [state, formAction, isPending] = useActionState(saveResultsDraft, initialState);
  const buttonLabel = isPending ? "Validating..." : "Create results draft PR";
  const currentYear = new Date().getFullYear().toString();
  const [raceIdValue, setRaceIdValue] = useState(initialValues?.raceId ?? "");
  const [yearValue, setYearValue] = useState(initialValues?.year ?? currentYear);
  const [csvTextValue, setCsvTextValue] = useState(
    normalizeLineEndings(initialValues?.csvText ?? "")
  );
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const debouncedCsvTextValue = useDebouncedValue(csvTextValue, LIVE_VALIDATION_DEBOUNCE_MS);
  const preview = useMemo(() => parsePreview(debouncedCsvTextValue), [debouncedCsvTextValue]);
  const liveIssues = useMemo(
    () => validateRaceResultsCsv(debouncedCsvTextValue),
    [debouncedCsvTextValue]
  );
  const liveErrors = liveIssues.filter((issue) => issue.level === "error");
  const liveWarnings = liveIssues.filter((issue) => issue.level === "warning");
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

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFileName(null);
      return;
    }

    const text = await file.text();
    setSelectedFileName(file.name);
    setCsvTextValue(normalizeLineEndings(text));

    if (!yearValue || yearValue === currentYear.toString()) {
      const yearFromName = file.name.replace(/\.csv$/i, "");
      setYearValue(yearFromName || currentYear);
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
        if (target.name === "resultsYear") {
          setYearValue(target.value.trim() || "YYYY");
        }
      }}
    >
      <input type="hidden" name="csvText" value={csvTextValue} />
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <div className="grid gap-5">
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
          <InputField
            label="Results filename"
            name="resultsYear"
            placeholder={currentYear}
            defaultValue={initialValues?.year}
            errors={state.fieldErrors?.year}
          />
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
                : "Upload a CSV file to populate the preview and validation checks."}
            </p>
          </label>
          <p className="text-sm leading-6 text-stone-600">
            The uploaded CSV is written exactly to `races/&lt;raceId&gt;/&lt;year&gt;.csv`.
            Use the preview and validation panels to confirm content before creating a draft PR.
          </p>
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
            Target path: <span className="font-semibold text-white">races/{raceIdValue || "<race>"}/{yearValue || "<year>"}.csv</span>
          </p>
          <p className="text-sm leading-6 text-stone-300">
            Validation: header checks, time format checks, and runner category checks
          </p>
          <p className="text-sm leading-6 text-stone-300">
            File format: raw CSV written directly to the content repository
          </p>
        </div>
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
                Validation status
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-200">
                {state.message ?? "Nothing submitted yet."}
              </p>
            </div>
            <button
              type="submit"
              disabled={isPending || blockingErrorsExist}
              className="rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-stone-500"
            >
              {buttonLabel}
            </button>
          </div>
          {blockingErrorsExist ? (
            <p className="text-sm leading-6 text-red-200">
              Fix live blocking errors before creating a draft PR.
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
