import { createHash, randomUUID } from "crypto";
import { gunzipSync } from "zlib";
import { z } from "zod";
import { contentConfig } from "@/lib/content-config";
import { env } from "@/lib/env";
import {
  getContentFileAtRef,
  upsertContentFileAtRef,
} from "@/lib/github";
import {
  normalizeRaceResultsHeaders,
  splitCsvLine,
} from "@/lib/results-csv";

const MAX_QUEUE_ITEMS = 800;
const CALENDAR_CACHE_TTL_MS = 10 * 60 * 1000;
const CALENDAR_RATE_LIMIT_RETRY_MS = 15 * 60 * 1000;
const CALENDAR_ERROR_RETRY_MS = 2 * 60 * 1000;

const STOP_WORDS = new Set([
  "a",
  "and",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "race",
  "races",
  "result",
  "results",
  "the",
  "to",
]);

type ResultsInboxKind = "results-upload" | "minor-correction";
type InferenceConfidence = "high" | "medium" | "low" | "none";
type InferenceSource = "explicit-pattern" | "calendar-match" | "calendar-suggestion" | "none";

type CorrectionField = "name" | "position" | "category" | "club";

export type ResultsInboxCorrectionChange = {
  field: CorrectionField;
  value: string;
};

export type ResultsInboxCorrectionRequest = {
  raceId: string;
  year: string;
  runnerName?: string;
  runnerPosition?: string;
  runnerCategory?: string;
  runnerClub?: string;
  changeText: string;
  changes: ResultsInboxCorrectionChange[];
  parseConfidence: InferenceConfidence;
};

export type ResultsInboxCorrectionRowMatch = {
  rowNumber: number;
  score: number;
  reasons: string[];
  name?: string;
  position?: string;
  category?: string;
  club?: string;
};

export type ApplyCorrectionResult =
  | {
      status: "matched";
      csvText: string;
      matchedRow: ResultsInboxCorrectionRowMatch;
      summary: string;
      candidates: ResultsInboxCorrectionRowMatch[];
    }
  | {
      status: "ambiguous" | "unmatched" | "invalid";
      message: string;
      candidates: ResultsInboxCorrectionRowMatch[];
    };

export type ResultsInboxRaceMatch = {
  raceId: string;
  raceName: string;
  score: number;
  reasons: string[];
};

type CalendarRaceEntry = {
  date: string;
  raceName: string;
  raceId: string;
  raceIdNormalized: string;
  raceNameTokens: string[];
  raceIdTokens: string[];
  raceNamePhraseNormalized: string;
};

type CalendarCacheEntry = {
  cachedAt: number;
  races: CalendarRaceEntry[];
};

type CalendarLookupState = {
  nextRetryAt: number;
  lastErrorMessage: string;
  lastLoggedAt: number;
};

let calendarRaceCache: CalendarCacheEntry | null = null;
let calendarLookupState: CalendarLookupState | null = null;

type ResultsInboxStatus =
  | "queued"
  | "draft-created"
  | "rejected"
  | "error";

export type ResultsInboxCandidate = {
  kind?: ResultsInboxKind;
  id: string;
  messageId: string;
  fingerprint: string;
  sender: string;
  subject: string;
  receivedAt: string;
  fileName: string;
  sourceType?: "csv" | "xlsx";
  selectedWorksheet?: string;
  worksheetScores?: Array<{
    sheetName: string;
    score: number;
    errorCount: number;
    warningCount: number;
    recognizedHeaderCount: number;
    dataRowCount: number;
  }>;
  csvText?: string;
  raceId: string;
  year: string;
  inferenceConfidence?: InferenceConfidence;
  inferenceSource?: InferenceSource;
  raceMatchCandidates?: ResultsInboxRaceMatch[];
  correctionRequest?: ResultsInboxCorrectionRequest;
  status: ResultsInboxStatus;
  submissionNumber?: number;
  submissionUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

type ResultsInboxStore = {
  version: 1;
  items: ResultsInboxCandidate[];
};

const resultsInboxCandidateSchema = z.object({
  kind: z.enum(["results-upload", "minor-correction"]).optional(),
  id: z.string().min(1),
  messageId: z.string().min(1),
  fingerprint: z.string().min(1),
  sender: z.string().min(1),
  subject: z.string().min(1),
  receivedAt: z.string().min(1),
  fileName: z.string().min(1),
  sourceType: z.enum(["csv", "xlsx"]).optional(),
  selectedWorksheet: z.string().min(1).optional(),
  worksheetScores: z
    .array(
      z.object({
        sheetName: z.string().min(1),
        score: z.number(),
        errorCount: z.number().int().nonnegative(),
        warningCount: z.number().int().nonnegative(),
        recognizedHeaderCount: z.number().int().nonnegative(),
        dataRowCount: z.number().int().nonnegative(),
      })
    )
    .optional(),
  csvText: z.string().min(1).optional(),
  raceId: z.string().min(1),
  year: z.string().min(1),
  inferenceConfidence: z.enum(["high", "medium", "low", "none"]).optional(),
  inferenceSource: z
    .enum(["explicit-pattern", "calendar-match", "calendar-suggestion", "none"])
    .optional(),
  raceMatchCandidates: z
    .array(
      z.object({
        raceId: z.string().min(1),
        raceName: z.string().min(1),
        score: z.number(),
        reasons: z.array(z.string()),
      })
    )
    .optional(),
  correctionRequest: z
    .object({
      raceId: z.string().min(1),
      year: z.string().min(1),
      runnerName: z.string().min(1).optional(),
      runnerPosition: z.string().min(1).optional(),
      runnerCategory: z.string().min(1).optional(),
      runnerClub: z.string().min(1).optional(),
      changeText: z.string().min(1),
      changes: z.array(
        z.object({
          field: z.enum(["name", "position", "category", "club"]),
          value: z.string().min(1),
        })
      ),
      parseConfidence: z.enum(["high", "medium", "low", "none"]),
    })
    .optional(),
  status: z.enum(["queued", "draft-created", "rejected", "error"]),
  submissionNumber: z.number().int().positive().optional(),
  submissionUrl: z.string().url().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

const resultsInboxStoreSchema = z.object({
  version: z.literal(1),
  items: z.array(resultsInboxCandidateSchema),
});

const calendarRaceSchema = z.object({
  Date: z.string().min(1),
  raceName: z.string().min(1),
  raceId: z.string().optional(),
});

const calendarRaceListSchema = z.array(calendarRaceSchema);

const correctionFieldLookup = new Map<string, CorrectionField>([
  ["name", "name"],
  ["position", "position"],
  ["category", "category"],
  ["club", "club"],
]);

function getStorePath(): string {
  return env.RESULTS_INBOX_STATE_PATH;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function getResultsInboxCandidateKind(candidate: ResultsInboxCandidate): ResultsInboxKind {
  return candidate.kind ?? "results-upload";
}

function sanitizeRaceId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeYear(value: string): string {
  return value.trim().replace(/[^0-9*]/g, "");
}

function normalizeAlphaNumeric(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function splitMessageTokens(value: string): string[] {
  const expanded = value.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  const tokens = expanded
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));

  return Array.from(new Set(tokens));
}

function toFileStem(fileName: string): string {
  return fileName.replace(/\.[A-Za-z0-9]+$/, "").trim();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeBulletKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseBulletFields(bodyText: string): Map<string, string> {
  const fields = new Map<string, string>();
  const lines = bodyText.replace(/\r\n?/g, "\n").split("\n");
  let currentKey: string | null = null;

  for (const line of lines) {
    const bulletMatch = line.match(/^\s*-\s*([^:]+):\s*(.*)$/);
    if (bulletMatch) {
      currentKey = normalizeBulletKey(bulletMatch[1] ?? "");
      fields.set(currentKey, normalizeWhitespace(bulletMatch[2] ?? ""));
      continue;
    }

    if (!currentKey) {
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      currentKey = null;
      continue;
    }

    fields.set(currentKey, normalizeWhitespace(`${fields.get(currentKey) ?? ""} ${trimmed}`));
  }

  return fields;
}

function parseCorrectionSubject(subject: string): { raceId?: string; year?: string } {
  const matched = normalizeWhitespace(subject).match(/correction\s+for\s+.+?\(([^)]+)\)\s+(\d{4}\*?)/i);
  if (!matched) {
    return {};
  }

  return {
    raceId: sanitizeRaceId(matched[1] ?? ""),
    year: sanitizeYear(matched[2] ?? ""),
  };
}

function parseCorrectionChanges(changeText: string): ResultsInboxCorrectionChange[] {
  const firstSentence = normalizeWhitespace(changeText).split(".", 1)[0] ?? "";
  const normalizedText = firstSentence.trim();
  if (!normalizedText) {
    return [];
  }

  const singleNameMatch = normalizedText.match(/^change\s+name\s+to\s+(.+)$/i);
  if (singleNameMatch?.[1]) {
    return [{ field: "name", value: normalizeWhitespace(singleNameMatch[1]) }];
  }

  const withoutPrefix = normalizedText.replace(/^change\s+/i, "").trim();
  const changes: ResultsInboxCorrectionChange[] = [];

  for (const segment of withoutPrefix.split(/\s*,\s*/)) {
    const matched = segment.match(/^([a-z ]+?)\s+to\s+(.+)$/i);
    if (!matched) {
      continue;
    }

    const field = correctionFieldLookup.get(normalizeBulletKey(matched[1] ?? ""));
    const value = normalizeWhitespace(matched[2] ?? "");
    if (!field || !value) {
      continue;
    }

    changes.push({ field, value });
  }

  return changes;
}

function serializeCsvLine(values: string[]): string {
  return values
    .map((value) => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }

      return value;
    })
    .join(",");
}

function normalizeComparisonValue(value: string | undefined): string {
  return normalizeWhitespace(value ?? "").toLowerCase();
}

function buildDisplayName(row: Record<string, string>): string {
  const fullName = normalizeWhitespace(row.Name ?? "");
  if (fullName) {
    return fullName;
  }

  return normalizeWhitespace(`${row.Firstname ?? ""} ${row.Surname ?? ""}`);
}

function splitNameParts(value: string): { firstName: string; surname: string } {
  const parts = normalizeWhitespace(value).split(" ").filter(Boolean);
  if (parts.length <= 1) {
    return {
      firstName: parts[0] ?? "",
      surname: "",
    };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    surname: parts[parts.length - 1] ?? "",
  };
}

function parseRaceResultsGrid(csvText: string): { headers: string[]; rows: string[][] } {
  const lines = csvText
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = normalizeRaceResultsHeaders(splitCsvLine(lines[0] ?? ""));
  const rows = lines.slice(1).map((line) => splitCsvLine(line));
  return { headers, rows };
}

function buildRowRecord(headers: string[], row: string[]): Record<string, string> {
  return headers.reduce<Record<string, string>>((record, header, index) => {
    record[header] = row[index] ?? "";
    return record;
  }, {});
}

function setRowValue(
  headers: string[],
  row: string[],
  field: CorrectionField,
  value: string
): string[] {
  const next = [...row];

  const setByHeader = (header: string, headerValue: string) => {
    const index = headers.indexOf(header);
    if (index >= 0) {
      next[index] = headerValue;
    }
  };

  if (field === "name") {
    if (headers.includes("Name")) {
      setByHeader("Name", value);
      return next;
    }

    const { firstName, surname } = splitNameParts(value);
    if (headers.includes("Firstname")) {
      setByHeader("Firstname", firstName);
    }
    if (headers.includes("Surname")) {
      setByHeader("Surname", surname);
    }
    return next;
  }

  if (field === "position") {
    if (headers.includes("RunnerPosition")) {
      setByHeader("RunnerPosition", value);
    }
    return next;
  }

  if (field === "category") {
    if (headers.includes("RunnerCategory")) {
      setByHeader("RunnerCategory", value);
    }
    return next;
  }

  if (headers.includes("Club")) {
    setByHeader("Club", value);
  }

  return next;
}

export function applyMinorCorrectionToCsv(
  csvText: string,
  correctionRequest: ResultsInboxCorrectionRequest
): ApplyCorrectionResult {
  const { headers, rows } = parseRaceResultsGrid(csvText);
  if (headers.length === 0 || rows.length === 0) {
    return {
      status: "invalid",
      message: "Results file is empty.",
      candidates: [],
    };
  }

  const requestedIdentifiers = [
    correctionRequest.runnerPosition ? "position" : null,
    correctionRequest.runnerName ? "name" : null,
    correctionRequest.runnerCategory ? "category" : null,
    correctionRequest.runnerClub ? "club" : null,
  ].filter((value): value is string => value !== null);

  if (requestedIdentifiers.length === 0) {
    return {
      status: "invalid",
      message: "Correction email does not identify a runner clearly enough.",
      candidates: [],
    };
  }

  const normalizedRequestedPosition = normalizeComparisonValue(correctionRequest.runnerPosition);
  const normalizedRequestedName = normalizeComparisonValue(correctionRequest.runnerName);
  const normalizedRequestedCategory = normalizeComparisonValue(correctionRequest.runnerCategory);
  const normalizedRequestedClub = normalizeComparisonValue(correctionRequest.runnerClub);

  const candidates = rows
    .map((row, rowIndex) => {
      const record = buildRowRecord(headers, row);
      const reasons: string[] = [];
      let score = 0;
      let mismatch = false;

      const rowPosition = normalizeComparisonValue(record.RunnerPosition);
      const rowName = normalizeComparisonValue(buildDisplayName(record));
      const rowCategory = normalizeComparisonValue(record.RunnerCategory);
      const rowClub = normalizeComparisonValue(record.Club);

      if (normalizedRequestedPosition) {
        if (rowPosition === normalizedRequestedPosition) {
          score += 50;
          reasons.push("Position matches.");
        } else {
          mismatch = true;
        }
      }

      if (normalizedRequestedName) {
        if (rowName === normalizedRequestedName) {
          score += 50;
          reasons.push("Name matches.");
        } else {
          mismatch = true;
        }
      }

      if (normalizedRequestedCategory) {
        if (rowCategory === normalizedRequestedCategory) {
          score += 20;
          reasons.push("Category matches.");
        } else {
          mismatch = true;
        }
      }

      if (normalizedRequestedClub) {
        if (rowClub === normalizedRequestedClub) {
          score += 20;
          reasons.push("Club matches.");
        } else {
          mismatch = true;
        }
      }

      return {
        rowNumber: rowIndex + 2,
        score,
        reasons,
        name: buildDisplayName(record),
        position: record.RunnerPosition,
        category: record.RunnerCategory,
        club: record.Club,
        mismatch,
      };
    })
    .filter((candidate) => !candidate.mismatch)
    .sort((left, right) => right.score - left.score);

  if (candidates.length === 0) {
    return {
      status: "unmatched",
      message: "No results row matched all supplied runner details.",
      candidates: [],
    };
  }

  const topScore = candidates[0]?.score ?? 0;
  const topMatches = candidates.filter((candidate) => candidate.score === topScore);
  if (topMatches.length !== 1) {
    return {
      status: "ambiguous",
      message: "More than one results row matches the supplied runner details.",
      candidates: candidates.slice(0, 5),
    };
  }

  const matchedRow = topMatches[0];
  const matchedIndex = matchedRow.rowNumber - 2;
  let updatedRow = [...rows[matchedIndex]];
  for (const change of correctionRequest.changes) {
    updatedRow = setRowValue(headers, updatedRow, change.field, change.value);
  }

  const updatedRows = rows.map((row, index) => (index === matchedIndex ? updatedRow : row));
  const nextCsvText = [
    serializeCsvLine(headers),
    ...updatedRows.map((row) => serializeCsvLine(row)),
  ].join("\n");

  return {
    status: "matched",
    csvText: `${nextCsvText.trimEnd()}\n`,
    matchedRow,
    summary: correctionRequest.changes
      .map((change) => `${change.field} → ${change.value}`)
      .join(", "),
    candidates: candidates.slice(0, 5),
  };
}

export function parseMinorCorrectionEmail(
  subject: string,
  bodyText: string
): ResultsInboxCorrectionRequest | null {
  const bulletFields = parseBulletFields(bodyText);
  const subjectHints = parseCorrectionSubject(subject);
  const raceId = sanitizeRaceId(
    bulletFields.get("raceid") ?? subjectHints.raceId ?? ""
  );
  const year = sanitizeYear(
    bulletFields.get("year") ?? subjectHints.year ?? ""
  );
  const runnerName = normalizeWhitespace(bulletFields.get("name") ?? "") || undefined;
  const runnerPosition = normalizeWhitespace(bulletFields.get("position") ?? "") || undefined;
  const runnerCategory = normalizeWhitespace(bulletFields.get("category") ?? "") || undefined;
  const runnerClub = normalizeWhitespace(bulletFields.get("club") ?? "") || undefined;
  const changeText = normalizeWhitespace(bulletFields.get("correction") ?? "");
  const changes = parseCorrectionChanges(changeText);

  const correctionIntent = /\bcorrection\b/i.test(subject) || bulletFields.has("correction");
  if (!correctionIntent) {
    return null;
  }

  if (!raceId || !year || changes.length === 0) {
    return null;
  }

  const parseConfidence: InferenceConfidence =
    bulletFields.has("raceid") && bulletFields.has("year") && bulletFields.has("correction")
      ? "high"
      : subjectHints.raceId && subjectHints.year
        ? "medium"
        : "low";

  return {
    raceId,
    year,
    runnerName,
    runnerPosition,
    runnerCategory,
    runnerClub,
    changeText,
    changes,
    parseConfidence,
  };
}

function getYearHint(value: string | undefined): string | undefined {
  const matched = String(value ?? "").match(/\b(19\d{2}|20\d{2})\b/);
  return matched?.[1];
}

function inferConfidence(topScore: number, secondScore: number): InferenceConfidence {
  const margin = topScore - secondScore;
  if (topScore >= 90 && margin >= 18) {
    return "high";
  }

  if (topScore >= 55 && margin >= 10) {
    return "medium";
  }

  if (topScore > 0) {
    return "low";
  }

  return "none";
}

function countSharedTokens(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const rightSet = new Set(right);
  return left.reduce((count, token) => (rightSet.has(token) ? count + 1 : count), 0);
}

async function loadCalendarRaceEntries(): Promise<CalendarRaceEntry[]> {
  const now = Date.now();
  if (calendarRaceCache && now - calendarRaceCache.cachedAt <= CALENDAR_CACHE_TTL_MS) {
    return calendarRaceCache.races;
  }

  if (calendarLookupState && now < calendarLookupState.nextRetryAt) {
    if (calendarRaceCache) {
      return calendarRaceCache.races;
    }

    throw new Error(calendarLookupState.lastErrorMessage);
  }

  const response = await fetch(env.RESULTS_INBOX_CALENDAR_URL, {
    method: "GET",
    headers: {
      Accept: "application/json,application/gzip;q=0.9,*/*;q=0.8",
      ...(env.VERCEL_AUTOMATION_BYPASS_SECRET
        ? { "x-vercel-protection-bypass": env.VERCEL_AUTOMATION_BYPASS_SECRET }
        : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const retryDelayMs = response.status === 429 ? CALENDAR_RATE_LIMIT_RETRY_MS : CALENDAR_ERROR_RETRY_MS;
    const message = `Calendar lookup failed with status ${response.status}`;

    calendarLookupState = {
      nextRetryAt: now + retryDelayMs,
      lastErrorMessage: message,
      lastLoggedAt: 0,
    };

    if (calendarRaceCache) {
      return calendarRaceCache.races;
    }

    throw new Error(message);
  }

  const rawBuffer = Buffer.from(await response.arrayBuffer());

  let rawText = "";
  try {
    rawText = gunzipSync(rawBuffer).toString("utf8");
  } catch {
    rawText = rawBuffer.toString("utf8");
  }

  const parsedJson = JSON.parse(rawText);
  const parsedCalendar = calendarRaceListSchema.parse(parsedJson);

  const races = parsedCalendar
    .map((entry) => {
      const raceId = entry.raceId?.trim() ?? entry.raceName.replaceAll(/\s+/g, "-");
      const raceName = entry.raceName.trim();
      const date = entry.Date.trim();
      const raceIdTokens = splitMessageTokens(raceId);
      const raceNameTokens = splitMessageTokens(raceName);

      if (!raceId || !raceName || raceNameTokens.length === 0) {
        return null;
      }

      return {
        raceId,
        raceName,
        date,
        raceIdNormalized: normalizeAlphaNumeric(raceId),
        raceIdTokens,
        raceNameTokens,
        raceNamePhraseNormalized: normalizeAlphaNumeric(raceName),
      } satisfies CalendarRaceEntry;
    })
    .filter((entry): entry is CalendarRaceEntry => entry !== null);

  calendarRaceCache = {
    cachedAt: now,
    races,
  };

  calendarLookupState = null;

  return races;
}

async function inferRaceIdFromCalendar(input: {
  subject: string;
  bodyText?: string;
  fileName: string;
  year?: string;
}): Promise<{
  selectedRaceId?: string;
  confidence: InferenceConfidence;
  source: InferenceSource;
  matches: ResultsInboxRaceMatch[];
}> {
  const bodyText = input.bodyText ?? "";
  const fileStem = toFileStem(input.fileName);
  const sourceText = `${input.subject}\n${bodyText}\n${fileStem}`;
  const messageTokens = splitMessageTokens(sourceText);
  const normalizedMessageText = normalizeAlphaNumeric(sourceText);
  const normalizedFileStem = normalizeAlphaNumeric(fileStem);
  const yearHint = getYearHint(input.year) ?? getYearHint(sourceText);

  if (messageTokens.length === 0) {
    return {
      confidence: "none",
      source: "none",
      matches: [],
    };
  }

  let races: CalendarRaceEntry[] = [];
  try {
    races = await loadCalendarRaceEntries();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown calendar lookup error.";
    const now = Date.now();
    const shouldLog =
      !calendarLookupState ||
      calendarLookupState.lastErrorMessage !== message ||
      now - calendarLookupState.lastLoggedAt >= 60_000;

    if (shouldLog) {
      console.warn("Results inbox race matching fallback:", message);

      if (calendarLookupState) {
        calendarLookupState = {
          ...calendarLookupState,
          lastLoggedAt: now,
        };
      }
    }

    return {
      confidence: "none",
      source: "none",
      matches: [],
    };
  }

  const scored = races
    .map((race) => {
      let score = 0;
      const reasons: string[] = [];

      if (race.raceIdNormalized.length > 0 && normalizedMessageText.includes(race.raceIdNormalized)) {
        score += 70;
        reasons.push("Race ID appears directly in message text.");
      }

      if (race.raceIdNormalized.length > 0 && normalizedFileStem.includes(race.raceIdNormalized)) {
        score += 35;
        reasons.push("Filename includes race ID.");
      }

      if (
        race.raceNamePhraseNormalized.length > 0 &&
        normalizedMessageText.includes(race.raceNamePhraseNormalized)
      ) {
        score += 30;
        reasons.push("Race name phrase appears in message text.");
      }

      const raceNameOverlap = countSharedTokens(race.raceNameTokens, messageTokens);
      if (raceNameOverlap > 0) {
        const coverage = raceNameOverlap / race.raceNameTokens.length;
        const coverageBonus = Math.round(coverage * 20);
        score += raceNameOverlap * 8 + coverageBonus;
        reasons.push(`Race name token overlap: ${raceNameOverlap}/${race.raceNameTokens.length}.`);
      }

      const raceIdOverlap = countSharedTokens(race.raceIdTokens, messageTokens);
      if (raceIdOverlap > 0) {
        score += raceIdOverlap * 14;
        reasons.push(`Race ID token overlap: ${raceIdOverlap}/${Math.max(race.raceIdTokens.length, 1)}.`);
      }

      if (yearHint) {
        if (race.date.startsWith(yearHint)) {
          score += 8;
          reasons.push(`Calendar date matches inferred year ${yearHint}.`);
        } else {
          score -= 2;
        }
      }

      return {
        raceId: race.raceId,
        raceName: race.raceName,
        score,
        reasons,
      } satisfies ResultsInboxRaceMatch;
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);

  const best = scored[0];
  const second = scored[1];
  const topScore = best?.score ?? 0;
  const secondScore = second?.score ?? 0;
  const confidence = inferConfidence(topScore, secondScore);

  return {
    selectedRaceId: confidence === "high" && best ? best.raceId : undefined,
    confidence,
    source: best ? (confidence === "high" ? "calendar-match" : "calendar-suggestion") : "none",
    matches: scored,
  };
}

function fingerprintCsv(csvText: string, fileName: string, raceId: string, year: string): string {
  const normalizedCsv = csvText.replace(/\r\n/g, "\n").trim();
  return createHash("sha256")
    .update(fileName.trim().toLowerCase())
    .update("\n")
    .update(raceId.trim().toLowerCase())
    .update("\n")
    .update(year.trim())
    .update("\n")
    .update(normalizedCsv)
    .digest("hex");
}

function fingerprintCorrection(
  subject: string,
  bodyText: string,
  correctionRequest: ResultsInboxCorrectionRequest
): string {
  return createHash("sha256")
    .update(normalizeWhitespace(subject).toLowerCase())
    .update("\n")
    .update(correctionRequest.raceId)
    .update("\n")
    .update(correctionRequest.year)
    .update("\n")
    .update(
      correctionRequest.changes
        .map((change) => `${change.field}:${change.value}`)
        .join("|")
        .toLowerCase()
    )
    .update("\n")
    .update(normalizeWhitespace(bodyText).toLowerCase())
    .digest("hex");
}

function parseRaceIdYearFromFileName(fileName: string): { raceId: string; year: string } | null {
  const normalizedFile = fileName.trim().toLowerCase();
  const matched = normalizedFile.match(/([a-z0-9-]+)[-_](\d{4}\*?)\.(?:csv|xlsx)$/);
  if (!matched) {
    return null;
  }

  const raceId = sanitizeRaceId(matched[1] ?? "");
  const year = sanitizeYear(matched[2] ?? "");
  if (!raceId || !year) {
    return null;
  }

  return { raceId, year };
}

function parseRaceIdYearFromSubject(subject: string): { raceId: string; year: string } | null {
  const normalizedSubject = subject.trim().toLowerCase();
  const matched = normalizedSubject.match(/([a-z0-9-]+)\s+(\d{4}\*?)\s+results/);
  if (!matched) {
    return null;
  }

  const raceId = sanitizeRaceId(matched[1] ?? "");
  const year = sanitizeYear(matched[2] ?? "");
  if (!raceId || !year) {
    return null;
  }

  return { raceId, year };
}

async function loadStore(): Promise<ResultsInboxStore> {
  const raw = await getContentFileAtRef(getStorePath(), contentConfig.stagingBranch, {
    nullOn404: true,
  });
  if (raw === null) {
    return { version: 1, items: [] };
  }

  try {
    const parsed = resultsInboxStoreSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return { version: 1, items: [] };
    }

    return {
      version: 1,
      items: parsed.data.items.map((item) => ({
        ...item,
        kind: item.kind ?? "results-upload",
      })),
    };
  } catch {
    return { version: 1, items: [] };
  }
}

async function saveStore(store: ResultsInboxStore): Promise<void> {
  console.log(`Saving results inbox store with ${store.items.length} items...`);
  const trimmedItems = store.items
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, MAX_QUEUE_ITEMS);

  await upsertContentFileAtRef({
    path: getStorePath(),
    ref: contentConfig.stagingBranch,
    commitMessage: "Update results inbox queue state",
    content: `${JSON.stringify({ version: 1, items: trimmedItems }, null, 2)}\n`,
  });
}

export async function listResultsInboxCandidates(): Promise<ResultsInboxCandidate[]> {
  const store = await loadStore();
  return store.items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getResultsInboxCandidate(id: string): Promise<ResultsInboxCandidate | null> {
  const store = await loadStore();
  return store.items.find((item) => item.id === id) ?? null;
}

export async function enqueueResultsInboxCandidate(input: {
  messageId: string;
  sender: string;
  subject: string;
  bodyText?: string;
  receivedAt?: string;
  fileName: string;
  sourceType?: "csv" | "xlsx";
  selectedWorksheet?: string;
  worksheetScores?: Array<{
    sheetName: string;
    score: number;
    errorCount: number;
    warningCount: number;
    recognizedHeaderCount: number;
    dataRowCount: number;
  }>;
  csvText: string;
  raceId?: string;
  year?: string;
}): Promise<{ candidate: ResultsInboxCandidate; duplicate: boolean }> {
  const store = await loadStore();

  const fromFileName = parseRaceIdYearFromFileName(input.fileName);
  const fromSubject = parseRaceIdYearFromSubject(input.subject);
  const explicitRaceId = sanitizeRaceId(
    input.raceId ?? fromFileName?.raceId ?? fromSubject?.raceId ?? ""
  );
  const year = sanitizeYear(input.year ?? fromFileName?.year ?? fromSubject?.year ?? "");

  let raceId = explicitRaceId;
  let inferenceConfidence: InferenceConfidence = "none";
  let inferenceSource: InferenceSource = "none";
  let raceMatchCandidates: ResultsInboxRaceMatch[] | undefined;

  if (raceId) {
    inferenceConfidence = "high";
    inferenceSource = "explicit-pattern";
  } else {
    const inferred = await inferRaceIdFromCalendar({
      subject: input.subject,
      bodyText: input.bodyText,
      fileName: input.fileName,
      year,
    });

    raceId = sanitizeRaceId(inferred.selectedRaceId ?? "");
    inferenceConfidence = inferred.confidence;
    inferenceSource = inferred.source;
    raceMatchCandidates = inferred.matches;
  }

  if (!raceId || !year) {
    throw new Error("Could not detect race ID and year from the incoming message.");
  }

  const fingerprint = fingerprintCsv(input.csvText, input.fileName, raceId, year);
  const existing = store.items.find(
    (item) =>
      item.fingerprint === fingerprint &&
      (item.status === "queued" || item.status === "draft-created")
  );

  if (existing) {
    return { candidate: existing, duplicate: true };
  }

  const timestamp = nowIso();
  const candidate: ResultsInboxCandidate = {
    kind: "results-upload",
    id: randomUUID(),
    messageId: input.messageId.trim() || randomUUID(),
    fingerprint,
    sender: input.sender.trim(),
    subject: input.subject.trim(),
    receivedAt: input.receivedAt?.trim() || timestamp,
    fileName: input.fileName.trim(),
    sourceType: input.sourceType,
    selectedWorksheet: input.selectedWorksheet,
    worksheetScores: input.worksheetScores,
    csvText: input.csvText,
    raceId,
    year,
    inferenceConfidence,
    inferenceSource,
    raceMatchCandidates,
    status: "queued",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.items.push(candidate);
  await saveStore(store);

  return { candidate, duplicate: false };
}

export async function enqueueMinorCorrectionCandidate(input: {
  messageId: string;
  sender: string;
  subject: string;
  bodyText: string;
  receivedAt?: string;
  correctionRequest: ResultsInboxCorrectionRequest;
}): Promise<{ candidate: ResultsInboxCandidate; duplicate: boolean }> {
  const store = await loadStore();
  const fingerprint = fingerprintCorrection(
    input.subject,
    input.bodyText,
    input.correctionRequest
  );
  const existing = store.items.find(
    (item) =>
      item.fingerprint === fingerprint &&
      (item.status === "queued" || item.status === "draft-created")
  );

  if (existing) {
    return { candidate: existing, duplicate: true };
  }

  const timestamp = nowIso();
  const candidate: ResultsInboxCandidate = {
    kind: "minor-correction",
    id: randomUUID(),
    messageId: input.messageId.trim() || randomUUID(),
    fingerprint,
    sender: input.sender.trim(),
    subject: input.subject.trim(),
    receivedAt: input.receivedAt?.trim() || timestamp,
    fileName: "(no attachment)",
    raceId: input.correctionRequest.raceId,
    year: input.correctionRequest.year,
    inferenceConfidence: input.correctionRequest.parseConfidence,
    inferenceSource: "explicit-pattern",
    correctionRequest: input.correctionRequest,
    status: "queued",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.items.push(candidate);
  await saveStore(store);

  return { candidate, duplicate: false };
}

export async function markResultsInboxCandidateRejected(id: string): Promise<ResultsInboxCandidate | null> {
  const store = await loadStore();
  const index = store.items.findIndex((item) => item.id === id);
  if (index < 0) {
    return null;
  }

  const current = store.items[index];
  const next: ResultsInboxCandidate = {
    ...current,
    status: "rejected",
    errorMessage: undefined,
    updatedAt: nowIso(),
  };
  store.items[index] = next;
  await saveStore(store);
  return next;
}

export async function markResultsInboxCandidateError(
  id: string,
  errorMessage: string
): Promise<ResultsInboxCandidate | null> {
  const store = await loadStore();
  const index = store.items.findIndex((item) => item.id === id);
  if (index < 0) {
    return null;
  }

  const current = store.items[index];
  const next: ResultsInboxCandidate = {
    ...current,
    status: "error",
    errorMessage: errorMessage.trim(),
    updatedAt: nowIso(),
  };
  store.items[index] = next;
  await saveStore(store);
  return next;
}

export async function markResultsInboxCandidateDraftCreated(input: {
  id: string;
  submissionNumber: number;
  submissionUrl: string;
}): Promise<ResultsInboxCandidate | null> {
  const store = await loadStore();
  const index = store.items.findIndex((item) => item.id === input.id);
  if (index < 0) {
    return null;
  }

  const current = store.items[index];
  const next: ResultsInboxCandidate = {
    ...current,
    status: "draft-created",
    submissionNumber: input.submissionNumber,
    submissionUrl: input.submissionUrl,
    errorMessage: undefined,
    updatedAt: nowIso(),
  };

  store.items[index] = next;
  await saveStore(store);
  return next;
}

export function summarizeResultsInbox(candidates: ResultsInboxCandidate[]): {
  queued: number;
  draftCreated: number;
  rejected: number;
  error: number;
} {
  return candidates.reduce(
    (summary, candidate) => {
      if (candidate.status === "queued") {
        summary.queued += 1;
      } else if (candidate.status === "draft-created") {
        summary.draftCreated += 1;
      } else if (candidate.status === "rejected") {
        summary.rejected += 1;
      } else {
        summary.error += 1;
      }

      return summary;
    },
    { queued: 0, draftCreated: 0, rejected: 0, error: 0 }
  );
}
