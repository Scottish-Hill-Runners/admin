import { splitCsvLine } from "@/lib/results-csv";

export type CalendarCsvIssue = {
  row: number | null;
  level: "error" | "warning";
  message: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RACE_ID_PATTERN = /^[A-Za-z0-9-]+$/;

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

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

function isValidCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString().slice(0, 10) === value;
}

export function parseCalendarCsvRows(csvText: string): string[][] {
  const lines = normalizeLineEndings(csvText)
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  return lines.map((line) => splitCsvLine(line).map((value) => value.trim()));
}

export function serializeCalendarCsvRows(rows: string[][]): string {
  return rows
    .map((row) => serializeCsvRow([row[0] ?? "", row[1] ?? ""]))
    .join("\n");
}

export function validateCalendarCsv(
  csvText: string,
  knownRaceIds: Iterable<string> = []
): CalendarCsvIssue[] {
  const issues: CalendarCsvIssue[] = [];
  const rows = parseCalendarCsvRows(csvText);

  if (rows.length === 0) {
    return [
      {
        row: null,
        level: "warning",
        message: "CSV content is empty.",
      },
    ];
  }

  const knownRaceIdSet = new Set(
    Array.from(knownRaceIds)
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
  );

  const seenRows = new Map<string, number>();

  rows.forEach((columns, index) => {
    const rowNumber = index + 1;

    if (columns.length !== 2) {
      issues.push({
        row: rowNumber,
        level: "warning",
        message: `Expected 2 columns (date,raceId) but found ${columns.length}.`,
      });
    }

    const dateValue = (columns[0] ?? "").trim();
    const raceIdValue = (columns[1] ?? "").trim();

    if (!dateValue) {
      issues.push({
        row: rowNumber,
        level: "error",
        message: "Date is required.",
      });
    } else if (!isValidCalendarDate(dateValue)) {
      issues.push({
        row: rowNumber,
        level: "error",
        message: `Date must be a real calendar date in yyyy-mm-dd format. Received '${dateValue}'.`,
      });
    }

    if (!raceIdValue) {
      issues.push({
        row: rowNumber,
        level: "warning",
        message: "RaceID is required.",
      });
    } else if (!RACE_ID_PATTERN.test(raceIdValue)) {
      issues.push({
        row: rowNumber,
        level: "warning",
        message: `RaceID must use only letters, numbers, and hyphens. Received '${raceIdValue}'.`,
      });
    } else if (knownRaceIdSet.size > 0 && !knownRaceIdSet.has(raceIdValue)) {
      issues.push({
        row: rowNumber,
        level: "warning",
        message: `Unknown RaceID '${raceIdValue}'.`,
      });
    }

    if (dateValue && raceIdValue) {
      const duplicateKey = `${dateValue}::${raceIdValue}`;
      const firstSeen = seenRows.get(duplicateKey);
      if (firstSeen !== undefined) {
        issues.push({
          row: rowNumber,
          level: "warning",
          message: `Duplicate row for ${dateValue},${raceIdValue} (already seen on row ${firstSeen}).`,
        });
      } else {
        seenRows.set(duplicateKey, rowNumber);
      }
    }
  });

  return issues;
}
