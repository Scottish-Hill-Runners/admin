import { createHash, randomUUID } from "crypto";
import { gunzipSync } from "zlib";
import { z } from "zod";
import { contentConfig } from "@/lib/content-config";
import { env } from "@/lib/env";
import {
  getContentFileAtRef,
  upsertContentFileAtRef,
} from "@/lib/github";

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

type InferenceConfidence = "high" | "medium" | "low" | "none";
type InferenceSource = "explicit-pattern" | "calendar-match" | "calendar-suggestion" | "none";

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
  csvText: string;
  raceId: string;
  year: string;
  inferenceConfidence?: InferenceConfidence;
  inferenceSource?: InferenceSource;
  raceMatchCandidates?: ResultsInboxRaceMatch[];
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
  csvText: z.string().min(1),
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

function getStorePath(): string {
  return env.RESULTS_INBOX_STATE_PATH;
}

function nowIso(): string {
  return new Date().toISOString();
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
      const raceId = entry.raceId?.trim() ?? entry.raceName.trim();
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

    return parsed.data;
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
