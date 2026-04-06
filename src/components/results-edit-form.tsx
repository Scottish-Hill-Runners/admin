"use client";

import { useId, useMemo, useState } from "react";
import { useActionState } from "react";
import {
  saveResultsDraft,
  type ResultsUploadState,
} from "@/app/races/results-actions";
import { validateRaceResultsCsv } from "@/lib/results-csv";

const initialState: ResultsUploadState = {
  status: "idle",
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
    rows: lines.slice(1, 6).map(splitLine),
  };
}

type ResultsEditFormProps = {
  raceId: string;
  year: string;
  csvText: string;
};

export function ResultsEditForm({ raceId, year, csvText }: ResultsEditFormProps) {
  const [state, formAction, isPending] = useActionState(saveResultsDraft, initialState);
  const buttonLabel = isPending ? "Updating..." : "Update results draft";
  const formId = useId();
  const [csvTextValue, setCsvTextValue] = useState(normalizeLineEndings(csvText));
  const preview = useMemo(() => parsePreview(csvTextValue), [csvTextValue]);
  const liveIssues = useMemo(() => validateRaceResultsCsv(csvTextValue), [csvTextValue]);
  const liveErrors = liveIssues.filter((issue) => issue.level === "error");
  const liveWarnings = liveIssues.filter((issue) => issue.level === "warning");
  const blockingErrorsExist = liveErrors.length > 0;
  const rowIssueLevels = useMemo(() => {
    const issueMap = new Map<number, "error" | "warning">();

    for (const issue of liveIssues) {
      if (!issue.row) {
        continue;
      }

      const existing = issueMap.get(issue.row);
      if (existing === "error") {
        continue;
      }

      issueMap.set(issue.row, issue.level);
    }

    return issueMap;
  }, [liveIssues]);

  return (
    <form
      action={formAction}
      className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"
      onInput={(event) => {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement;
        if (target.name === "csvText") {
          setCsvTextValue(normalizeLineEndings(target.value));
        }
      }}
    >
      <input type="hidden" name="resultsRaceId" value={raceId} />
      <input type="hidden" name="resultsYear" value={year} />

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600 mb-1">
              Race ID
            </p>
            <p className="text-lg font-semibold text-stone-900">{raceId}</p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600 mb-1">
              Results year
            </p>
            <p className="text-lg font-semibold text-stone-900">{year}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-[#172119] p-6 text-stone-50 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
        <div className="mb-5 rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
            Draft summary
          </p>
          <p className="mt-3 text-sm leading-6 text-stone-200">
            Target path: <span className="font-semibold text-white">races/{raceId}/{year}.csv</span>
          </p>
          <p className="text-sm leading-6 text-stone-300">
            Validation: header checks, time format checks, and runner category checks
          </p>
        </div>
        <label className="block space-y-2">
          <span className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
            CSV data
          </span>
          <textarea
            id={`${formId}-csv`}
            name="csvText"
            rows={16}
            className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-stone-50 outline-none transition focus:border-lime-200/40"
            value={csvTextValue}
            onChange={(event) => setCsvTextValue(normalizeLineEndings(event.target.value))}
          />
          {state.fieldErrors?.csvText?.map((error) => (
            <p key={error} className="text-sm text-red-200">
              {error}
            </p>
          ))}
        </label>

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
              Fix live blocking errors before updating the results.
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
              Live validation preview
            </p>
            {csvTextValue.trim().length > 0 ? (
              <div className="mt-3 space-y-4">
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="rounded-full bg-red-950/60 px-3 py-1 text-red-200">
                    Errors: {liveErrors.length}
                  </span>
                  <span className="rounded-full bg-amber-950/60 px-3 py-1 text-amber-200">
                    Warnings: {liveWarnings.length}
                  </span>
                </div>

                {liveErrors.length > 0 ? (
                  <div>
                    <p className="text-sm font-semibold text-red-200">Blocking errors</p>
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-stone-200">
                      {liveErrors.slice(0, 8).map((issue) => (
                        <li key={`error-${issue.row ?? "none"}-${issue.message}`}>
                          {issue.row
                            ? `Row ${issue.row}: ${issue.message}`
                            : issue.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-emerald-200">
                    No blocking errors detected in the current CSV content.
                  </p>
                )}

                {liveWarnings.length > 0 ? (
                  <div>
                    <p className="text-sm font-semibold text-amber-200">Warnings</p>
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-stone-200">
                      {liveWarnings.slice(0, 8).map((issue) => (
                        <li key={`warning-${issue.row ?? "none"}-${issue.message}`}>
                          {issue.row
                            ? `Row ${issue.row}: ${issue.message}`
                            : issue.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-stone-400">
                Edit CSV content above to see validation results.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
              CSV preview
            </p>
            {preview.headers.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm text-stone-200">
                  <thead>
                    <tr>
                      {preview.headers.map((header) => (
                        <th key={header} className="border-b border-white/10 px-2 py-2 font-semibold text-lime-100">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, rowIndex) => (
                      <tr
                        key={`${rowIndex}-${row.join("|")}`}
                        className={
                          rowIssueLevels.get(rowIndex + 2) === "error"
                            ? "bg-red-950/30"
                            : rowIssueLevels.get(rowIndex + 2) === "warning"
                              ? "bg-amber-950/20"
                              : undefined
                        }
                      >
                        {preview.headers.map((header, columnIndex) => (
                          <td key={`${header}-${columnIndex}`} className="border-b border-white/5 px-2 py-2 align-top">
                            {row[columnIndex] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-sm leading-6 text-stone-400">
                  Showing {preview.rows.length} preview rows.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-stone-400">
                Edit CSV content above to preview headers and rows here.
              </p>
            )}
          </div>
        </div>
      </section>
    </form>
  );
}
