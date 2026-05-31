"use client";

import { useMemo, useState, useCallback, useRef, Fragment, useEffect } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  saveResultsDraft,
  type ResultsUploadState,
} from "@/app/races/results-actions";
import { validateRaceResultsCsv, splitCsvLine } from "@/lib/results-csv";

const initialState: ResultsUploadState = {
  status: "idle",
};

const CLUB_HEADERS = ["Club"];
const CATEGORY_HEADERS = ["RunnerCategory", "Category", "Cat"];
const RUNNER_CATEGORY_PATTERN = /^(M|F|A|NB?)\d{0,2}$/;

type BulkFixField = "club" | "runnerCategory";

type BulkFixSuggestion = {
  field: BulkFixField;
  fieldLabel: string;
  gridRowIndex: number;
  colIndex: number;
  originalValue: string;
  replacementValue: string;
};

type CellEditSnapshot = {
  gridRowIndex: number;
  colIndex: number;
  originalValue: string;
} | null;

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

/** Serialize a single row back to a CSV line, quoting fields that need it. */
function serializeCsvRow(fields: string[]): string {
  return fields
    .map((field) => {
      if (field.includes(",") || field.includes('"') || field.includes("\n")) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    })
    .join(",");
}

/** Parse a CSV string into a 2-D array: [headerRow, ...dataRows]. */
function parseCsvGrid(csvText: string): string[][] {
  const lines = normalizeLineEndings(csvText)
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  return lines.map(splitCsvLine);
}

/** Serialize a 2-D grid back to a CSV string. */
function serializeCsvGrid(grid: string[][]): string {
  return grid.map(serializeCsvRow).join("\n");
}

function countCellMatches(grid: string[][], colIndex: number, value: string): number {
  const target = value.trim();
  if (!target) {
    return 0;
  }

  return grid.slice(1).filter((row) => (row[colIndex] ?? "").trim() === target).length;
}

function applyCellReplacement(grid: string[][], colIndex: number, fromValue: string, toValue: string): string[][] {
  const source = fromValue.trim();
  const replacement = toValue.trim();

  if (!source || !replacement) {
    return grid;
  }

  return grid.map((row, rowIndex) => {
    if (rowIndex === 0) {
      return row;
    }

    const nextRow = [...row];
    if ((nextRow[colIndex] ?? "").trim() === source) {
      nextRow[colIndex] = replacement;
    }
    return nextRow;
  });
}

function getBulkField(header: string): BulkFixField | null {
  const normalized = header.trim();
  if (CLUB_HEADERS.includes(normalized)) {
    return "club";
  }
  if (CATEGORY_HEADERS.includes(normalized)) {
    return "runnerCategory";
  }
  return null;
}

function getFieldLabel(field: BulkFixField): string {
  return field === "club" ? "Club" : "Runner category";
}

function isBulkFixEligible(field: BulkFixField, value: string, knownClubNames?: ReadonlySet<string>): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (field === "club") {
    if (!knownClubNames) {
      return false;
    }

    const lowered = trimmed.toLowerCase();
    return lowered !== "unattached" && !knownClubNames.has(lowered);
  }

  return !RUNNER_CATEGORY_PATTERN.test(trimmed);
}

type ResultsEditFormProps = {
  raceId: string;
  year: string;
  csvText: string;
  knownClubNames?: string[];
  returnToWorkflowUrl?: string;
};

export function ResultsEditForm({ raceId, year, csvText, knownClubNames, returnToWorkflowUrl }: ResultsEditFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(saveResultsDraft, initialState);
  const buttonLabel = isPending ? "Updating..." : "Update results draft";

  useEffect(() => {
    if (state.status !== "success" || !state.redirectToWorkflowUrl) {
      return;
    }

    router.push(state.redirectToWorkflowUrl);
  }, [router, state.redirectToWorkflowUrl, state.status]);

  // grid[0] = header row, grid[1..] = data rows
  const [grid, setGrid] = useState<string[][]>(() => parseCsvGrid(csvText));
  const [editSnapshot, setEditSnapshot] = useState<CellEditSnapshot>(null);
  const [bulkFixSuggestion, setBulkFixSuggestion] = useState<BulkFixSuggestion | null>(null);
  const bulkFixSuggestionRef = useRef<BulkFixSuggestion | null>(null);

  const headers = grid[0] ?? [];
  const dataRows = grid.slice(1);
  const colCount = headers.length;

  const csvTextValue = useMemo(() => serializeCsvGrid(grid), [grid]);

  const clubNameSet = useMemo(
    () => (knownClubNames ? new Set(knownClubNames) : undefined),
    [knownClubNames]
  );
  const liveIssues = useMemo(
    () => validateRaceResultsCsv(csvTextValue, { knownClubNames: clubNameSet }),
    [csvTextValue, clubNameSet]
  );
  const liveErrors = liveIssues.filter((issue) => issue.level === "error");
  const liveWarnings = liveIssues.filter((issue) => issue.level === "warning");
  const liveNotes = liveIssues.filter((issue) => issue.level === "note");
  const blockingErrorsExist = liveErrors.length > 0;

  const errorRows = useMemo(() => {
    const rows = new Set<number>();
    for (const issue of liveErrors) {
      if (issue.row) rows.add(issue.row);
    }
    return rows;
  }, [liveErrors]);

  const warningRows = useMemo(() => {
    const rows = new Set<number>();
    for (const issue of liveWarnings) {
      if (issue.row) rows.add(issue.row);
    }
    return rows;
  }, [liveWarnings]);

  const noteRows = useMemo(() => {
    const rows = new Set<number>();
    for (const issue of liveNotes) {
      if (issue.row) rows.add(issue.row);
    }
    return rows;
  }, [liveNotes]);

  const errorRowMessages = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const issue of liveErrors) {
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
  }, [liveErrors]);

  const warningRowMessages = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const issue of liveWarnings) {
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
  }, [liveWarnings]);

  const noteRowMessages = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const issue of liveNotes) {
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
  }, [liveNotes]);

  const [showWarningMessages, setShowWarningMessages] = useState(true);

  const updateCell = useCallback((rowIndex: number, colIndex: number, value: string) => {
    setGrid((prev) => {
      const next = prev.map((row) => [...row]);
      if (!next[rowIndex]) next[rowIndex] = [];
      next[rowIndex][colIndex] = value;

      return next;
    });
  }, []);

  const handleCellFocus = useCallback((rowIndex: number, colIndex: number) => {
    if (rowIndex <= 0) {
      setEditSnapshot(null);
      return;
    }

    setEditSnapshot({
      gridRowIndex: rowIndex,
      colIndex,
      originalValue: (grid[rowIndex]?.[colIndex] ?? "").trim(),
    });
  }, [grid]);

  const handleCellBlur = useCallback((rowIndex: number, colIndex: number) => {
    if (rowIndex <= 0) {
      return;
    }

    const snapshot = editSnapshot;
    setGrid((prev) => {
      const header = prev[0]?.[colIndex] ?? "";
      const field = getBulkField(header);
      if (!field) {
        setBulkFixSuggestion(null);
        setEditSnapshot(null);
        return prev;
      }

      if (!snapshot || snapshot.gridRowIndex !== rowIndex || snapshot.colIndex !== colIndex) {
        setBulkFixSuggestion(null);
        return prev;
      }

      const currentValue = (prev[rowIndex]?.[colIndex] ?? "").trim();
      if (!currentValue || currentValue === snapshot.originalValue) {
        setBulkFixSuggestion(null);
        return prev;
      }

      if (!isBulkFixEligible(field, snapshot.originalValue, clubNameSet)) {
        setBulkFixSuggestion(null);
        return prev;
      }

      const matchCount = countCellMatches(prev, colIndex, snapshot.originalValue);
      if (matchCount <= 1) {
        setBulkFixSuggestion(null);
        return prev;
      }

      setBulkFixSuggestion({
        field,
        fieldLabel: getFieldLabel(field),
        gridRowIndex: rowIndex,
        colIndex,
        originalValue: snapshot.originalValue,
        replacementValue: currentValue,
      });
      bulkFixSuggestionRef.current = {
        field,
        fieldLabel: getFieldLabel(field),
        gridRowIndex: rowIndex,
        colIndex,
        originalValue: snapshot.originalValue,
        replacementValue: currentValue,
      };
      setEditSnapshot(null);
      return prev;
    });
  }, [clubNameSet, editSnapshot]);

  const deleteRow = useCallback((dataRowIndex: number) => {
    setGrid((prev) => prev.filter((_, i) => i !== dataRowIndex + 1));
  }, []);

  const addRow = useCallback(() => {
    setGrid((prev) => [...prev, Array<string>(colCount).fill("")]);
  }, [colCount]);

  const applyBulkFix = useCallback(() => {
    const suggestion = bulkFixSuggestionRef.current ?? bulkFixSuggestion;
    if (!suggestion) {
      return;
    }

    setGrid((prev) =>
      applyCellReplacement(
        prev,
        suggestion.colIndex,
        suggestion.originalValue,
        suggestion.replacementValue
      )
    );
    bulkFixSuggestionRef.current = null;
    setBulkFixSuggestion(null);
    setEditSnapshot(null);
  }, [bulkFixSuggestion]);

  const activeBulkSuggestion = useMemo(() => {
    if (!bulkFixSuggestion) {
      return null;
    }

    const currentValue = (grid[bulkFixSuggestion.gridRowIndex]?.[bulkFixSuggestion.colIndex] ?? "").trim();
    const remainingMatches = countCellMatches(grid, bulkFixSuggestion.colIndex, bulkFixSuggestion.originalValue);

    if (currentValue !== bulkFixSuggestion.replacementValue || remainingMatches <= 0) {
      return null;
    }

    return {
      ...bulkFixSuggestion,
      remainingMatches,
    };
  }, [bulkFixSuggestion, grid]);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <input type="hidden" name="resultsRaceId" value={raceId} />
      <input type="hidden" name="resultsYear" value={year} />
      <input type="hidden" name="csvText" value={csvTextValue} />
      {returnToWorkflowUrl ? (
        <input type="hidden" name="returnToWorkflowUrl" value={returnToWorkflowUrl} />
      ) : null}

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
              Fix live blocking errors before updating the results.
            </p>
          ) : null}

          {state.issues && state.issues.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
                CSV issues
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-200">
                {state.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
              Results grid
            </p>
            {headers.length > 0 ? (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-full bg-red-950/60 px-3 py-1 text-red-200">
                    Errors: {liveErrors.length}
                  </span>
                  <span className="rounded-full bg-amber-950/60 px-3 py-1 text-amber-200">
                    Warnings: {liveWarnings.length}
                  </span>
                  {liveWarnings.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowWarningMessages((v) => !v)}
                      className="ml-auto rounded-full border border-amber-300/30 px-3 py-1 text-amber-200/70 transition hover:border-amber-300/60 hover:text-amber-200"
                    >
                      {showWarningMessages ? "Hide warning details" : "Show warning details"}
                    </button>
                  ) : null}
                </div>
                {activeBulkSuggestion ? (
                  <div className="mb-4 rounded-2xl border border-amber-300/30 bg-amber-950/30 p-4 text-sm text-amber-50 shadow-[0_10px_24px_rgba(120,53,15,0.18)]">
                    <p className="font-semibold">Apply this change to matching rows?</p>
                    <p className="mt-2 leading-6 text-amber-100/90">
                      You changed {activeBulkSuggestion.fieldLabel} from <span className="font-semibold">{activeBulkSuggestion.originalValue}</span> to <span className="font-semibold">{activeBulkSuggestion.replacementValue}</span>.
                      There {activeBulkSuggestion.remainingMatches === 1 ? "is 1 other row" : `are ${activeBulkSuggestion.remainingMatches} other rows`} that still use the old value.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={applyBulkFix}
                        className="rounded-full bg-amber-300 px-4 py-2 font-semibold text-amber-950 transition hover:bg-amber-200"
                      >
                        Apply to all matching rows
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkFixSuggestion(null)}
                        className="rounded-full border border-amber-300/30 px-4 py-2 font-semibold text-amber-100 transition hover:border-amber-300/60 hover:text-white"
                      >
                        Keep this one only
                      </button>
                    </div>
                  </div>
                ) : null}
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
                <div className="max-h-[36rem] overflow-auto rounded-xl border border-white/10">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-[#1f2b20]">
                      <tr>
                        {headers.map((header, colIndex) => (
                          <th
                            key={colIndex}
                            className="border-b border-white/10 p-0"
                          >
                            <input
                              type="text"
                              value={header}
                              onChange={(e) => updateCell(0, colIndex, e.target.value)}
                              className="w-full min-w-[6rem] bg-transparent px-2 py-2 text-sm font-semibold text-lime-100 outline-none focus:bg-white/10"
                              aria-label={`Column ${colIndex + 1} header`}
                            />
                          </th>
                        ))}
                        {/* spacer for delete column */}
                        <th className="border-b border-white/10 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {dataRows.map((row, dataRowIndex) => {
                        const rowNumber = dataRowIndex + 2;
                        const hasError = errorRows.has(rowNumber);
                        const hasWarning = !hasError && warningRows.has(rowNumber);
                        const hasNote = !hasError && !hasWarning && noteRows.has(rowNumber);
                        const rowErrorMessages = errorRowMessages.get(rowNumber);
                        const rowWarningMessages = warningRowMessages.get(rowNumber);
                        const rowNoteMessages = noteRowMessages.get(rowNumber);

                        return (
                          <Fragment key={dataRowIndex}>
                            <tr
                              style={
                                hasError
                                  ? { backgroundColor: "rgba(185, 28, 28, 0.45)" }
                                  : hasWarning
                                    ? { backgroundColor: "rgba(180, 120, 0, 0.40)" }
                                    : hasNote
                                      ? { backgroundColor: "rgba(100, 100, 100, 0.25)" }
                                      : undefined
                              }
                            >
                              {headers.map((_, colIndex) => (
                                <td
                                  key={colIndex}
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
                                    value={row[colIndex] ?? ""}
                                    onChange={(e) => updateCell(dataRowIndex + 1, colIndex, e.target.value)}
                                    onFocus={() => handleCellFocus(dataRowIndex + 1, colIndex)}
                                    onBlur={() => handleCellBlur(dataRowIndex + 1, colIndex)}
                                    className={`w-full min-w-[5rem] bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-white/10 ${
                                      hasError
                                        ? "text-red-50 placeholder:text-red-300/50"
                                        : hasWarning
                                          ? "text-amber-50 placeholder:text-amber-300/50"
                                          : "text-stone-200"
                                    }`}
                                    aria-label={`Row ${rowNumber}, ${headers[colIndex] ?? `column ${colIndex + 1}`}`}
                                  />
                                </td>
                              ))}
                              <td className={`border-b p-0 text-center ${hasError ? "border-red-300/25" : hasWarning ? "border-amber-300/25" : "border-white/5"}`}>
                                <button
                                  type="button"
                                  onClick={() => deleteRow(dataRowIndex)}
                                  className="px-2 py-1.5 text-stone-500 transition hover:text-red-300"
                                  aria-label={`Delete row ${rowNumber}`}
                                  title="Delete row"
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                            {rowErrorMessages && rowErrorMessages.length > 0 ? (
                              <tr style={{ backgroundColor: "rgba(185, 28, 28, 0.25)" }}>
                                <td colSpan={colCount + 1} className="border-b border-red-300/15 px-2 py-1">
                                  <ul className="space-y-0.5">
                                    {rowErrorMessages.map((msg) => (
                                      <li key={msg} className="text-xs text-red-200">⚠ {msg}</li>
                                    ))}
                                  </ul>
                                </td>
                              </tr>
                            ) : null}
                            {rowWarningMessages && rowWarningMessages.length > 0 && showWarningMessages ? (
                              <tr style={{ backgroundColor: "rgba(180, 120, 0, 0.20)" }}>
                                <td colSpan={colCount + 1} className="border-b border-amber-300/15 px-2 py-1">
                                  <ul className="space-y-0.5">
                                    {rowWarningMessages.map((msg) => (
                                      <li key={msg} className="text-xs text-amber-200">ℹ {msg}</li>
                                    ))}
                                  </ul>
                                </td>
                              </tr>
                            ) : null}
                            {rowNoteMessages && rowNoteMessages.length > 0 && showWarningMessages ? (
                              <tr style={{ backgroundColor: "rgba(180, 120, 0, 0.20)" }}>
                                <td colSpan={colCount + 1} className="border-b border-amber-300/15 px-2 py-1">
                                  <ul className="space-y-0.5">
                                    {rowNoteMessages.map((msg) => (
                                      <li key={msg} className="text-xs text-amber-200">ℹ {msg}</li>
                                    ))}
                                  </ul>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}

                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <p className="text-sm leading-6 text-stone-400">
                    {dataRows.length} data row{dataRows.length !== 1 ? "s" : ""}
                  </p>
                  <button
                    type="button"
                    onClick={addRow}
                    className="rounded-full border border-white/20 px-4 py-1.5 text-sm font-medium text-stone-300 transition hover:border-white/40 hover:text-white"
                  >
                    + Add row
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-stone-400">
                No CSV data loaded.
              </p>
            )}
          </div>
        </div>
      </section>
    </form>
  );
}
