"use client";

import { useActionState, useCallback, useMemo, useState } from "react";
import {
  saveCalendarDraft,
  type CalendarActionState,
} from "@/app/calendar/actions";
import {
  parseCalendarCsvRows,
  serializeCalendarCsvRows,
  validateCalendarCsv,
} from "@/lib/calendar-csv";

const initialState: CalendarActionState = {
  status: "idle",
};

type CalendarEditFormProps = {
  initialCsvText: string;
  knownRaceIds: string[];
};

export function CalendarEditForm({
  initialCsvText,
  knownRaceIds,
}: CalendarEditFormProps) {
  const [state, formAction, isPending] = useActionState(saveCalendarDraft, initialState);
  const buttonLabel = isPending ? "Updating..." : "Update calendar draft";
  const raceIdSuggestions = useMemo(
    () => Array.from(new Set(knownRaceIds)).sort((left, right) => left.localeCompare(right)),
    [knownRaceIds]
  );

  const [rows, setRows] = useState<string[][]>(() => {
    const parsed = parseCalendarCsvRows(initialCsvText);
    return parsed.length > 0 ? parsed : [["", ""]];
  });

  const csvTextValue = useMemo(() => serializeCalendarCsvRows(rows), [rows]);
  const liveIssues = useMemo(
    () => validateCalendarCsv(csvTextValue, knownRaceIds),
    [csvTextValue, knownRaceIds]
  );
  const liveErrors = liveIssues.filter((issue) => issue.level === "error");
  const liveWarnings = liveIssues.filter((issue) => issue.level === "warning");
  const blockingErrorsExist = liveErrors.length > 0;

  const errorRows = useMemo(() => {
    const value = new Set<number>();
    for (const issue of liveErrors) {
      if (issue.row) {
        value.add(issue.row);
      }
    }
    return value;
  }, [liveErrors]);

  const warningRows = useMemo(() => {
    const value = new Set<number>();
    for (const issue of liveWarnings) {
      if (issue.row) {
        value.add(issue.row);
      }
    }
    return value;
  }, [liveWarnings]);

  const rowMessages = useMemo(() => {
    const value = new Map<number, string[]>();

    for (const issue of liveIssues) {
      if (!issue.row) {
        continue;
      }

      const existing = value.get(issue.row);
      if (existing) {
        existing.push(issue.message);
      } else {
        value.set(issue.row, [issue.message]);
      }
    }

    return value;
  }, [liveIssues]);

  const updateCell = useCallback((rowIndex: number, colIndex: number, value: string) => {
    setRows((previous) => {
      const next = previous.map((row) => [...row]);
      if (!next[rowIndex]) {
        next[rowIndex] = ["", ""];
      }
      next[rowIndex][colIndex] = value;
      return next;
    });
  }, []);

  const addRow = useCallback(() => {
    setRows((previous) => [...previous, ["", ""]]);
  }, []);

  const deleteRow = useCallback((rowIndex: number) => {
    setRows((previous) => {
      if (previous.length <= 1) {
        return [["", ""]];
      }

      return previous.filter((_, index) => index !== rowIndex);
    });
  }, []);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <input type="hidden" name="csvText" value={csvTextValue} />

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <div className="grid gap-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
              Format
            </p>
            <p className="mt-1 text-sm leading-6 text-stone-700">
              One row per event in the format yyyy-mm-dd,RaceID.
            </p>
            <p className="text-sm leading-6 text-stone-700">
              Example: 2026-03-14,CraigDunain
            </p>
          </div>
          <p className="text-sm leading-6 text-stone-600">
            Unknown RaceID values are warnings only so you can stage new race IDs before race metadata is published.
          </p>
          {state.fieldErrors?.csvText?.map((error) => (
            <p key={error} className="text-sm text-red-700">
              {error}
            </p>
          ))}
          <div className="rounded-2xl border border-stone-900/10 bg-stone-50 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-700">
              Known races
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {knownRaceIds.length} race IDs available for warning checks.
            </p>
            <p className="text-sm leading-6 text-stone-600">
              RaceID fields support autocomplete suggestions as you type.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-[#172119] p-6 text-stone-50 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
        <div className="mb-5 rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
            Draft summary
          </p>
          <p className="mt-3 text-sm leading-6 text-stone-200">
            Target path: <span className="font-semibold text-white">calendar.csv</span>
          </p>
          <p className="text-sm leading-6 text-stone-300">
            Validation: date format, race ID format, duplicates, and unknown race warnings
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
              Fix live blocking errors before updating the calendar.
            </p>
          ) : null}

          {state.issues && state.issues.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
                CSV issues
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-200">
                {state.issues.slice(0, 16).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
              Calendar grid
            </p>
            <div className="mb-3 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-red-950/60 px-3 py-1 text-red-200">
                Errors: {liveErrors.length}
              </span>
              <span className="rounded-full bg-amber-950/60 px-3 py-1 text-amber-200">
                Warnings: {liveWarnings.length}
              </span>
            </div>
            <div className="max-h-[36rem] overflow-auto rounded-xl border border-white/10">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[#1f2b20]">
                  <tr>
                    <th className="border-b border-white/10 px-2 py-2 font-semibold text-lime-100">Date</th>
                    <th className="border-b border-white/10 px-2 py-2 font-semibold text-lime-100">RaceID</th>
                    <th className="border-b border-white/10 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => {
                    const rowNumber = rowIndex + 1;
                    const hasError = errorRows.has(rowNumber);
                    const hasWarning = !hasError && warningRows.has(rowNumber);
                    const tooltip = rowMessages.get(rowNumber)?.join("\n");

                    return (
                      <tr
                        key={rowIndex}
                        title={tooltip}
                        style={
                          hasError
                            ? { backgroundColor: "rgba(185, 28, 28, 0.45)" }
                            : hasWarning
                              ? { backgroundColor: "rgba(180, 120, 0, 0.40)" }
                              : undefined
                        }
                      >
                        <td
                          className={`border-b p-0 ${
                            hasError
                              ? "border-red-300/25"
                              : hasWarning
                                ? "border-amber-300/25"
                                : "border-white/5"
                          }`}
                        >
                          <input
                            type="text"
                            value={row[0] ?? ""}
                            onChange={(event) => updateCell(rowIndex, 0, event.target.value)}
                            className={`w-full min-w-[9rem] bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-white/10 ${
                              hasError
                                ? "text-red-50 placeholder:text-red-300/50"
                                : hasWarning
                                  ? "text-amber-50 placeholder:text-amber-300/50"
                                  : "text-stone-200"
                            }`}
                            placeholder="yyyy-mm-dd"
                            aria-label={`Row ${rowNumber} date`}
                          />
                        </td>
                        <td
                          className={`border-b p-0 ${
                            hasError
                              ? "border-red-300/25"
                              : hasWarning
                                ? "border-amber-300/25"
                                : "border-white/5"
                          }`}
                        >
                          <input
                            type="text"
                            value={row[1] ?? ""}
                            onChange={(event) => updateCell(rowIndex, 1, event.target.value)}
                            list="calendar-race-id-suggestions"
                            className={`w-full min-w-[10rem] bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-white/10 ${
                              hasError
                                ? "text-red-50 placeholder:text-red-300/50"
                                : hasWarning
                                  ? "text-amber-50 placeholder:text-amber-300/50"
                                  : "text-stone-200"
                            }`}
                            placeholder="RaceID"
                            aria-label={`Row ${rowNumber} race id`}
                          />
                        </td>
                        <td
                          className={`border-b p-0 text-center ${
                            hasError
                              ? "border-red-300/25"
                              : hasWarning
                                ? "border-amber-300/25"
                                : "border-white/5"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => deleteRow(rowIndex)}
                            className="px-2 py-1.5 text-stone-500 transition hover:text-red-300"
                            aria-label={`Delete row ${rowNumber}`}
                            title="Delete row"
                          >
                            x
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {raceIdSuggestions.length > 0 ? (
              <datalist id="calendar-race-id-suggestions">
                {raceIdSuggestions.map((raceId) => (
                  <option key={raceId} value={raceId} />
                ))}
              </datalist>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-4">
              <p className="text-sm leading-6 text-stone-400">
                {rows.length} row{rows.length !== 1 ? "s" : ""}
              </p>
              <button
                type="button"
                onClick={addRow}
                className="rounded-full border border-white/20 px-4 py-1.5 text-sm font-medium text-stone-300 transition hover:border-white/40 hover:text-white"
              >
                + Add row
              </button>
            </div>
          </div>
        </div>
      </section>
    </form>
  );
}
