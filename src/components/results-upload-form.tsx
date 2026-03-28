"use client";

import { ChangeEvent, useId, useMemo, useState } from "react";
import { useActionState } from "react";
import {
  saveResultsDraft,
  type ResultsUploadState,
} from "@/app/races/results-actions";
import { validateRaceResultsCsv } from "@/lib/results-csv";

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

export function ResultsUploadForm({ initialValues }: ResultsUploadFormProps) {
  const [state, formAction, isPending] = useActionState(saveResultsDraft, initialState);
  const buttonLabel = isPending ? "Validating..." : "Create results draft PR";
  const formId = useId();
  const [raceIdValue, setRaceIdValue] = useState(initialValues?.raceId ?? "RaceId");
  const [yearValue, setYearValue] = useState(initialValues?.year ?? "YYYY");
  const [csvTextValue, setCsvTextValue] = useState(
    normalizeLineEndings(initialValues?.csvText ?? "")
  );
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
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

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFileName(null);
      return;
    }

    const text = await file.text();
    setSelectedFileName(file.name);
    setCsvTextValue(normalizeLineEndings(text));

    if (!yearValue || yearValue === "YYYY") {
      const yearFromName = file.name.replace(/\.csv$/i, "");
      setYearValue(yearFromName || "YYYY");
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
        if (target.name === "csvText") {
          setCsvTextValue(normalizeLineEndings(target.value));
        }
      }}
    >
      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <div className="grid gap-5">
          <InputField
            label="Race ID"
            name="resultsRaceId"
            placeholder="Carnethy5"
            defaultValue={initialValues?.raceId}
            errors={state.fieldErrors?.raceId}
          />
          <InputField
            label="Results filename"
            name="resultsYear"
            placeholder="2024"
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
                : "Upload a CSV file to populate the editor, or paste CSV directly below."}
            </p>
          </label>
          <p className="text-sm leading-6 text-stone-600">
            Paste CSV data exactly as it should be written to `races/&lt;raceId&gt;/&lt;year&gt;.csv`.
            This first version focuses on validation and draft creation; richer upload tooling can sit on top later.
          </p>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-[#172119] p-6 text-stone-50 shadow-[0_22px_55px_rgba(23,33,25,0.24)]">
        <div className="mb-5 rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200/80">
            Draft summary
          </p>
          <p className="mt-3 text-sm leading-6 text-stone-200">
            Target path: <span className="font-semibold text-white">races/{raceIdValue}/{yearValue}.csv</span>
          </p>
          <p className="text-sm leading-6 text-stone-300">
            Validation: header checks, time format checks, and runner category checks
          </p>
          <p className="text-sm leading-6 text-stone-300">
            File format: raw CSV written directly to the content repository
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
            placeholder="Example: RunnerPosition,Surname,Firstname,Club,RunnerCategory,FinishTime,1,Smith,John,Local Club,M,42:11"
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
                Upload or paste CSV content to see validation results before submitting.
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
                Upload or paste CSV content to preview headers and the first rows here.
              </p>
            )}
          </div>
        </div>
      </section>
    </form>
  );
}
