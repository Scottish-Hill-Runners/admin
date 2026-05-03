import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import matter from "gray-matter";
import { env } from "@/lib/env";
import { contentConfig } from "@/lib/content-config";
import {
  getNewsSlugSuffixFromPath,
  isIsoNewsDate,
  suggestNextNewsSlugSuffix,
} from "@/lib/news-slug";
import type {
  ChampionshipInfoFormData,
  ChampionshipListItem,
  ChampionshipYearEntry,
  ClubInfoFormData,
  ClubListItem,
  InfoFormData,
  InfoListItem,
  LongDistanceFormData,
  LongDistanceListItem,
  NewsFrontmatter,
  NewsListItem,
  RaceInfoFormData,
  RaceListItem,
  RaceResultListItem,
} from "@/lib/content-types";

type RepoRef = {
  owner: string;
  repo: string;
};

type ContentPrAuthor = {
  name: string;
  email: string;
};

type CreateContentPrInput = {
  title: string;
  path: string;
  content: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  branchName: string;
  author?: ContentPrAuthor;
  labels?: string[];
};

type CreateContentPrFileInput = {
  path: string;
  content: string;
  encoding?: "utf8" | "base64";
  commitMessage?: string;
};

type CreateContentPrWithFilesInput = {
  title: string;
  files: CreateContentPrFileInput[];
  commitMessage: string;
  prTitle: string;
  prBody: string;
  branchName: string;
  author?: ContentPrAuthor;
  labels?: string[];
};

type RepositoryDirectoryEntry = {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
};

type RepositoryFileEntry = {
  path: string;
  type: "file";
  content: string;
  sha: string;
};

type CachedGetEntry = {
  data: unknown;
  cachedAt: number;
  lastAccessedAt: number;
};

type PullRequestListItem = {
  number: number;
  updated_at?: string;
};

type PullRequestFileItem = {
  filename: string;
  status: string;
};

const githubGetCache = new Map<string, CachedGetEntry>();
const GITHUB_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_GITHUB_CACHE_ENTRIES = 250;
const MAX_OPEN_PULL_REQUESTS = 50;
const MAX_OPEN_PULL_REQUEST_AGE_DAYS = 30;
const MAX_PULL_REQUEST_FILES = 400;
const MAX_PR_FILE_SCAN_CONCURRENCY = 6;
const MAX_NEWS_LIST_ITEMS = 24;
const CACHE_SNAPSHOT_LOG_INTERVAL = 50;

let githubRequestCounter = 0;

export function getGitHubClient(): Octokit | null {
  if (env.GITHUB_TOKEN) {
    return new Octokit({ auth: env.GITHUB_TOKEN });
  }

  if (
    env.GITHUB_APP_ID &&
    env.GITHUB_APP_PRIVATE_KEY &&
    env.GITHUB_APP_INSTALLATION_ID
  ) {
    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.GITHUB_APP_ID,
        privateKey: env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
        installationId: env.GITHUB_APP_INSTALLATION_ID,
      },
    });
  }

  return null;
}

export function parseRepoSlug(repoSlug: string): { owner: string; repo: string } {
  const [owner, repo] = repoSlug.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repository slug: ${repoSlug}`);
  }
  return { owner, repo };
}

function toBase64(input: string): string {
  return Buffer.from(input, "utf8").toString("base64");
}

function fromBase64(input: string): string {
  return Buffer.from(input, "base64").toString("utf8");
}

function normalizeRepoPath(path: string): string {
  const decoded = decodeURIComponent(String(path).trim());

  return decoded
    .replace(/^\/+/, "")
    .replace(/^(?:contents\/+)+/, "");
}

function toSafeRepoPathSegment(value: string): string | null {
  const decoded = decodeURIComponent(String(value ?? "").trim());

  if (!decoded || decoded === "." || decoded === "..") {
    return null;
  }

  if (decoded.includes("/") || decoded.includes("\\")) {
    return null;
  }

  return decoded;
}

function toSafeRepoRelativeFilePath(value: string): string | null {
  const decoded = decodeURIComponent(String(value ?? "").trim())
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if (!decoded) {
    return null;
  }

  if (decoded.includes("\\")) {
    return null;
  }

  const segments = decoded.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }

  const directorySegments = segments.slice(0, -1);
  if (directorySegments.some((segment) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segment))) {
    return null;
  }

  const fileName = segments[segments.length - 1];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(fileName)) {
    return null;
  }

  return segments.join("/");
}

function buildGitHubGetCacheKey(route: string, params: Record<string, unknown>): string {
  const sortedEntries = Object.entries(params).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  return `${route}:${JSON.stringify(sortedEntries)}`;
}

function isGitHubPerfDebugEnabled(): boolean {
  return env.GITHUB_DEBUG_PERF;
}

function estimateApproxBytes(value: unknown): number {
  if (typeof value === "string") {
    return Buffer.byteLength(value, "utf8");
  }

  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return 0;
  }
}

function logGitHubPerf(event: string, details: Record<string, unknown>): void {
  if (!isGitHubPerfDebugEnabled()) {
    return;
  }

  console.info(`[github-perf] ${event}`, details);
}

function logGitHubCacheSnapshotIfNeeded(): void {
  if (!isGitHubPerfDebugEnabled()) {
    return;
  }

  githubRequestCounter += 1;
  if (githubRequestCounter % CACHE_SNAPSHOT_LOG_INTERVAL !== 0) {
    return;
  }

  let approxBytes = 0;
  for (const entry of githubGetCache.values()) {
    approxBytes += estimateApproxBytes(entry.data);
  }

  logGitHubPerf("cache-snapshot", {
    entries: githubGetCache.size,
    approxRetainedBytes: approxBytes,
  });
}

function pruneGitHubGetCache(now: number): void {
  for (const [key, entry] of githubGetCache.entries()) {
    if (now - entry.cachedAt > GITHUB_CACHE_TTL_MS) {
      githubGetCache.delete(key);
    }
  }

  if (githubGetCache.size <= MAX_GITHUB_CACHE_ENTRIES) {
    return;
  }

  const candidates = Array.from(githubGetCache.entries()).sort(
    (left, right) => left[1].lastAccessedAt - right[1].lastAccessedAt
  );

  const overflow = githubGetCache.size - MAX_GITHUB_CACHE_ENTRIES;
  for (let index = 0; index < overflow; index += 1) {
    const candidate = candidates[index];
    if (candidate) {
      githubGetCache.delete(candidate[0]);
    }
  }
}

function isPullRequestRecent(updatedAt: string | undefined): boolean {
  if (!updatedAt) {
    return true;
  }

  const updatedAtMs = Date.parse(updatedAt);
  if (Number.isNaN(updatedAtMs)) {
    return true;
  }

  const maxAgeMs = MAX_OPEN_PULL_REQUEST_AGE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - updatedAtMs <= maxAgeMs;
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<U>
): Promise<U[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<U>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        break;
      }

      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

function getErrorStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const status = (error as { status?: unknown }).status;
  if (typeof status === "number") {
    return status;
  }

  if (typeof status === "string") {
    const parsed = Number.parseInt(status, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const responseStatus = (error as { response?: { status?: unknown } }).response?.status;
  if (typeof responseStatus === "number") {
    return responseStatus;
  }

  if (typeof responseStatus === "string") {
    const parsed = Number.parseInt(responseStatus, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const message = (error as { message?: unknown }).message;
  if (typeof message === "string") {
    const matchedStatus = message.match(/\b(\d{3})\b/);
    if (matchedStatus) {
      const parsed = Number.parseInt(matchedStatus[1], 10);
      return Number.isNaN(parsed) ? null : parsed;
    }
  }

  return null;
}

async function requestGitHubGet<T>(
  client: Octokit,
  route: string,
  params: Record<string, unknown>
): Promise<T> {
  const requestStartedAt = Date.now();
  const requestStartedPerf = isGitHubPerfDebugEnabled() ? performance.now() : 0;

  pruneGitHubGetCache(requestStartedAt);
  const cacheKey = buildGitHubGetCacheKey(route, params);
  const existingCached = githubGetCache.get(cacheKey);
  const cachedIsFresh =
    existingCached !== undefined && requestStartedAt - existingCached.cachedAt <= GITHUB_CACHE_TTL_MS;
  const cached = cachedIsFresh ? existingCached : undefined;

  if (!cachedIsFresh && existingCached) {
    githubGetCache.delete(cacheKey);
  }

  if (cached) {
    cached.lastAccessedAt = requestStartedAt;
    logGitHubPerf("request", {
      route,
      durationMs: 0,
      cacheStatus: "hit",
      approxResponseBytes: estimateApproxBytes(cached.data),
    });
    logGitHubCacheSnapshotIfNeeded();
    return cached.data as T;
  }

  try {
    const response = await client.request(route, {
      ...params,
    });

    const now = Date.now();
    githubGetCache.set(cacheKey, {
      data: response.data,
      cachedAt: now,
      lastAccessedAt: now,
    });
    pruneGitHubGetCache(now);

    logGitHubPerf("request", {
      route,
      durationMs: Math.round((isGitHubPerfDebugEnabled() ? performance.now() : 0) - requestStartedPerf),
      cacheStatus: "miss",
      approxResponseBytes: estimateApproxBytes(response.data),
    });
    logGitHubCacheSnapshotIfNeeded();

    return response.data as T;
  } catch (error) {
    logGitHubPerf("request-error", {
      route,
      durationMs: Date.now() - requestStartedAt,
      status: getErrorStatus(error),
    });

    throw error;
  }
}

function normalizeNewsDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateMatch) {
    return raw;
  }

  const dmyDateMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyDateMatch) {
    const [, day, month, year] = dmyDateMatch;
    return `${year}-${month}-${day}`;
  }

  const parsedDate = new Date(raw);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().slice(0, 10);
  }

  return "";
}

async function getDefaultBranchSha(client: Octokit, repo: RepoRef, branch: string) {
  const response = await requestGitHubGet<{ object: { sha: string } }>(
    client,
    "GET /repos/{owner}/{repo}/git/ref/{ref}",
    {
    owner: repo.owner,
    repo: repo.repo,
    ref: `heads/${branch}`,
    }
  );

  return response.object.sha;
}

async function getExistingFileSha(
  client: Octokit,
  repo: RepoRef,
  path: string,
  ref: string
): Promise<string | undefined> {
  try {
    const existing = await requestGitHubGet<RepositoryDirectoryEntry[] | RepositoryFileEntry>(
      client,
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: repo.owner,
        repo: repo.repo,
        path,
        ref,
      }
    );

    if (!Array.isArray(existing) && "sha" in existing) {
      return existing.sha;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

async function getRepositoryFile(path: string): Promise<string>;
async function getRepositoryFile(path: string, options: { nullOn404: true }): Promise<string | null>;
async function getRepositoryFile(path: string, options?: { nullOn404?: boolean }): Promise<string | null> {
  const client = getGitHubClient();
  if (!client) {
    throw new Error("GitHub credentials are not configured. Set GITHUB_TOKEN or GitHub App values.");
  }

  const repo = parseRepoSlug(contentConfig.repo);
  const normalizedPath = normalizeRepoPath(path);

  let response: RepositoryDirectoryEntry[] | RepositoryFileEntry;
  try {
    response = await requestGitHubGet<RepositoryDirectoryEntry[] | RepositoryFileEntry>(
      client,
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: repo.owner,
        repo: repo.repo,
        path: normalizedPath,
        ref: contentConfig.branch,
      }
    );
  } catch (error) {
    if (options?.nullOn404 && getErrorStatus(error) === 404) {
      return null;
    }
    throw error;
  }

  if (Array.isArray(response) || !("content" in response)) {
    throw new Error(`Expected a file at ${normalizedPath}`);
  }

  return fromBase64(response.content.replace(/\n/g, ""));
}

export async function getContentFile(path: string): Promise<string> {
  return getRepositoryFile(path);
}

async function getRepositoryDirectory(path: string): Promise<RepositoryDirectoryEntry[]>;
async function getRepositoryDirectory(path: string, options: { nullOn404: true }): Promise<RepositoryDirectoryEntry[] | null>;
async function getRepositoryDirectory(path: string, options?: { nullOn404?: boolean }): Promise<RepositoryDirectoryEntry[] | null> {
  const client = getGitHubClient();
  if (!client) {
    throw new Error("GitHub credentials are not configured. Set GITHUB_TOKEN or GitHub App values.");
  }

  const repo = parseRepoSlug(contentConfig.repo);
  const normalizedPath = normalizeRepoPath(path);

  let response: RepositoryDirectoryEntry[] | RepositoryFileEntry;
  try {
    response = await requestGitHubGet<RepositoryDirectoryEntry[] | RepositoryFileEntry>(
      client,
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: repo.owner,
        repo: repo.repo,
        path: normalizedPath,
        ref: contentConfig.branch,
      }
    );
  } catch (error) {
    if (options?.nullOn404 && getErrorStatus(error) === 404) {
      return null;
    }
    throw error;
  }

  if (!Array.isArray(response)) {
    throw new Error(`Expected a directory at ${normalizedPath}`);
  }

  return response;
}

async function getRepositoryFiles(path: string, extension: string, ref = contentConfig.branch) {
  const client = getGitHubClient();
  if (!client) {
    throw new Error("GitHub credentials are not configured. Set GITHUB_TOKEN or GitHub App values.");
  }

  const repo = parseRepoSlug(contentConfig.repo);
  const normalizedPath = normalizeRepoPath(path).replace(/\/+$/, "");
  const fileEntries: Array<{ name: string; path: string }> = [];
  const directoriesToScan: string[] = [normalizedPath];

  while (directoriesToScan.length > 0) {
    const currentPath = directoriesToScan.pop();
    if (!currentPath) {
      continue;
    }

    const response = await requestGitHubGet<RepositoryDirectoryEntry[] | RepositoryFileEntry>(
      client,
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: repo.owner,
        repo: repo.repo,
        path: currentPath,
        ref,
      }
    );

    if (!Array.isArray(response)) {
      continue;
    }

    for (const entry of response) {
      if (entry.type === "dir") {
        directoriesToScan.push(entry.path);
        continue;
      }

      if (entry.type !== "file" || !entry.path.endsWith(extension)) {
        continue;
      }

      fileEntries.push({
        name: entry.name,
        path: entry.path,
      });
    }
  }

  return fileEntries;
}

async function listOpenPullRequestNumbers(client: Octokit, repo: RepoRef): Promise<number[]> {
  const openPullRequests = await requestGitHubGet<PullRequestListItem[]>(
    client,
    "GET /repos/{owner}/{repo}/pulls",
    {
      owner: repo.owner,
      repo: repo.repo,
      state: "open",
      sort: "updated",
      direction: "desc",
      per_page: MAX_OPEN_PULL_REQUESTS,
      page: 1,
    }
  );

  return openPullRequests
    .filter((pullRequest) => isPullRequestRecent(pullRequest.updated_at))
    .map((pullRequest) => pullRequest.number);
}

async function listNewsFilePathsInPullRequest(
  client: Octokit,
  repo: RepoRef,
  pullRequestNumber: number,
  yearPathPrefix: string
): Promise<string[]> {
  const files: string[] = [];
  let page = 1;

  while (files.length < MAX_PULL_REQUEST_FILES) {
    const pullRequestFiles = await requestGitHubGet<PullRequestFileItem[]>(
      client,
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
      {
        owner: repo.owner,
        repo: repo.repo,
        pull_number: pullRequestNumber,
        per_page: 100,
        page,
      }
    );

    if (pullRequestFiles.length === 0) {
      break;
    }

    for (const file of pullRequestFiles) {
      if (file.status === "removed") {
        continue;
      }

      if (!file.filename.startsWith(yearPathPrefix) || !file.filename.endsWith(".md")) {
        continue;
      }

      files.push(file.filename);
      if (files.length >= MAX_PULL_REQUEST_FILES) {
        break;
      }
    }

    if (pullRequestFiles.length < 100) {
      break;
    }

    page += 1;
  }

  return files;
}

export async function listReservedNewsSlugSuffixes(date: string): Promise<string[]> {
  const normalizedDate = date.trim();
  if (!isIsoNewsDate(normalizedDate)) {
    return [];
  }

  const year = normalizedDate.slice(0, 4);
  const yearPath = `news/${year}`;
  const reservedSuffixes = new Set<string>();

  try {
    const branchFiles = await getRepositoryFiles(yearPath, ".md");
    for (const entry of branchFiles) {
      const suffix = getNewsSlugSuffixFromPath(normalizedDate, entry.path);
      if (suffix !== null) {
        reservedSuffixes.add(suffix);
      }
    }
  } catch {
    return [];
  }

  try {
    const client = getGitHubClient();
    if (!client) {
      return Array.from(reservedSuffixes);
    }

    const repo = parseRepoSlug(contentConfig.repo);
    const openPullRequestNumbers = await listOpenPullRequestNumbers(client, repo);
    const yearPathPrefix = `${yearPath}/`;

    const pullRequestFilePaths = await mapWithConcurrency(
      openPullRequestNumbers,
      MAX_PR_FILE_SCAN_CONCURRENCY,
      (pullRequestNumber) =>
        listNewsFilePathsInPullRequest(client, repo, pullRequestNumber, yearPathPrefix)
    );

    for (const filePaths of pullRequestFilePaths) {
      for (const filePath of filePaths) {
        const suffix = getNewsSlugSuffixFromPath(normalizedDate, filePath);
        if (suffix !== null) {
          reservedSuffixes.add(suffix);
        }
      }
    }
  } catch {
    // Fall back to branch-only reservations if open PR scanning fails.
  }

  return Array.from(reservedSuffixes);
}

export async function suggestNewsSlugSuffixForDate(date: string): Promise<string> {
  const reservedSuffixes = await listReservedNewsSlugSuffixes(date);
  if (!reservedSuffixes.includes("")) {
    return "";
  }

  return suggestNextNewsSlugSuffix(reservedSuffixes);
}

export async function listNewsDrafts(): Promise<NewsListItem[]> {
  try {
    const entries = await getRepositoryDirectory("news");
    const years = entries
      .filter((entry) => entry.type === "dir")
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left));

    const markdownFiles: Array<{ name: string; path: string }> = [];

    for (const year of years) {
      if (markdownFiles.length >= MAX_NEWS_LIST_ITEMS) {
        break;
      }

      const yearEntries = await getRepositoryDirectory(`news/${year}`);
      for (const entry of yearEntries) {
        if (entry.type !== "file" || !entry.name.endsWith(".md")) {
          continue;
        }

        markdownFiles.push({
          name: entry.name,
          path: entry.path,
        });
      }
    }

    const items = markdownFiles
      .sort((left, right) => right.name.localeCompare(left.name))
      .slice(0, MAX_NEWS_LIST_ITEMS)
      .map((entry) => ({
        slug: entry.path.replace(/^news\//, "").replace(/\.md$/, ""),
      }) satisfies NewsListItem);

    return items;
  } catch {
    return [];
  }
}

export async function listRaceDrafts(): Promise<RaceListItem[]> {
  try {
    const entries = await getRepositoryDirectory("races");
    const directories = entries
      .filter((entry) => entry.type === "dir")
      .sort((left, right) => left.name.localeCompare(right.name));

    const items = directories.map((entry) => ({ raceId: entry.name }) satisfies RaceListItem);

    return items;
  } catch {
    return [];
  }
}

export async function getNewsDraft(slug: string): Promise<
  | {
      slug: string;
      data: NewsFrontmatter;
      content: string;
    }
  | null
> {
  const file = await getRepositoryFile(`news/${slug}.md`, { nullOn404: true });
  if (file === null) {
    return null;
  }

  const parsed = matter(file);
  const normalizedDate = normalizeNewsDate(parsed.data.date);

  return {
    slug,
    data: {
      title: String(parsed.data.title ?? ""),
      date: normalizedDate,
      excerpt: String(parsed.data.excerpt ?? ""),
    },
    content: parsed.content.trim(),
  };
}

export async function getRaceDraft(raceId: string): Promise<RaceInfoFormData | null> {
  const safeRaceId = toSafeRepoPathSegment(raceId);
  if (!safeRaceId) {
    return null;
  }

  const file = await getRepositoryFile(`races/${safeRaceId}/index.md`, { nullOn404: true });
  if (file === null) {
    return null;
  }

  const parsed = matter(file);

  return {
    raceId: safeRaceId,
    title: String(parsed.data.title ?? ""),
    venue: String(parsed.data.venue ?? ""),
    distance: String(parsed.data.distance ?? ""),
    climb: String(parsed.data.climb ?? ""),
    maleRecord: String(parsed.data.maleRecord ?? parsed.data.record ?? ""),
    femaleRecord: String(parsed.data.femaleRecord ?? ""),
    nonBinaryRecord: String(parsed.data.nonBinaryRecord ?? ""),
    web: String(parsed.data.web ?? ""),
    organiser: String(parsed.data.organiser ?? ""),
    content: parsed.content.trim(),
  };
}

export async function getRaceResultsDraft(
  raceId: string,
  year: string
): Promise<
  | {
      raceId: string;
      year: string;
      csvText: string;
    }
  | null
> {
  const safeRaceId = toSafeRepoPathSegment(raceId);
  const safeYear = toSafeRepoPathSegment(year);
  if (!safeRaceId || !safeYear) {
    return null;
  }

  const file = await getRepositoryFile(`races/${safeRaceId}/${safeYear}.csv`, { nullOn404: true });
  if (file === null) {
    return null;
  }

  const normalizedFile = file.replace(/\r\n?/g, "\n");
  return {
    raceId: safeRaceId,
    year: safeYear,
    csvText: normalizedFile.trim(),
  };
}

export async function getCalendarDraft(): Promise<
  | {
      csvText: string;
    }
  | null
> {
  try {
    const file = await getRepositoryFile("calendar.csv");
    const normalizedFile = file.replace(/\r\n?/g, "\n");

    return {
      csvText: normalizedFile.trim(),
    };
  } catch {
    return null;
  }
}

export async function getHomepageImagesDraft(): Promise<string | null> {
  try {
    return await getRepositoryFile("homepage/images.yaml", { nullOn404: true });
  } catch {
    return null;
  }
}

export async function getDocumentsManifestDraft(): Promise<string | null> {
  try {
    return await getRepositoryFile("documents/manifest.yaml", { nullOn404: true });
  } catch {
    return null;
  }
}

export async function getCommitteePortraitsDraft(): Promise<string | null> {
  try {
    return await getRepositoryFile("committee/portraits.yaml", { nullOn404: true });
  } catch {
    return null;
  }
}

export async function getRaceImagesDraft(raceId: string): Promise<string | null> {
  const safeRaceId = toSafeRepoPathSegment(raceId);
  if (!safeRaceId) {
    return null;
  }

  const entries = await getRepositoryDirectory(`races/${safeRaceId}`, { nullOn404: true });
  if (!entries) {
    return null;
  }

  const imagesEntry = entries.find(
    (entry) => entry.type === "file" && entry.name === "images.yaml"
  );
  if (!imagesEntry) {
    return null;
  }

  try {
    return await getRepositoryFile(imagesEntry.path, { nullOn404: true });
  } catch {
    return null;
  }
}

export async function listRaceResultsDrafts(raceId: string): Promise<RaceResultListItem[]> {
  const safeRaceId = toSafeRepoPathSegment(raceId);
  if (!safeRaceId) {
    return [];
  }

  const entries = await getRepositoryDirectory(`races/${safeRaceId}`, { nullOn404: true });
  if (!entries) {
    return [];
  }

  return entries
    .filter((entry) => entry.type === "file" && entry.name.endsWith(".csv"))
    .map((entry) => ({
      raceId: safeRaceId,
      year: entry.name.replace(/\.csv$/, ""),
      path: `races/${safeRaceId}/${entry.name}`,
    }))
    .sort((left, right) => right.year.localeCompare(left.year));
}

async function ensureStagingBranch(client: Octokit, repo: RepoRef): Promise<string> {
  const stagingBranch = contentConfig.stagingBranch;

  try {
    await requestGitHubGet<{ object: { sha: string } }>(
      client,
      "GET /repos/{owner}/{repo}/git/ref/{ref}",
      { owner: repo.owner, repo: repo.repo, ref: `heads/${stagingBranch}` }
    );
    return stagingBranch;
  } catch (error) {
    if (getErrorStatus(error) !== 404) {
      throw error;
    }
  }

  // Staging branch does not exist yet — create it from the live branch.
  const liveSha = await getDefaultBranchSha(client, repo, contentConfig.branch);
  await client.git.createRef({
    owner: repo.owner,
    repo: repo.repo,
    ref: `refs/heads/${stagingBranch}`,
    sha: liveSha,
  });

  return stagingBranch;
}

export type StagingStatus =
  | { state: "up-to-date" }
  | { state: "ahead"; aheadBy: number; behindBy: number; prUrl: string | null }
  | { state: "error"; message: string };

export async function getStagingStatus(): Promise<StagingStatus> {
  const client = getGitHubClient();
  if (!client) {
    return { state: "error", message: "Publishing is not set up yet. Please contact an administrator." };
  }

  const repo = parseRepoSlug(contentConfig.repo);

  let comparison: { ahead_by: number; behind_by: number };
  try {
    comparison = await requestGitHubGet<{ ahead_by: number; behind_by: number }>(
      client,
      "GET /repos/{owner}/{repo}/compare/{base}...{head}",
      {
        owner: repo.owner,
        repo: repo.repo,
        base: contentConfig.branch,
        head: contentConfig.stagingBranch,
      }
    );
  } catch (error) {
    if (getErrorStatus(error) === 404) {
      return { state: "up-to-date" };
    }
    return { state: "error", message: "Could not check publishing status right now." };
  }

  if (comparison.ahead_by === 0) {
    return { state: "up-to-date" };
  }

  // Check for an existing open staging → live PR.
  let prUrl: string | null = null;
  try {
    const existingPrs = await requestGitHubGet<Array<{ number: number; html_url: string; head: { ref: string }; base: { ref: string } }>>(
      client,
      "GET /repos/{owner}/{repo}/pulls",
      {
        owner: repo.owner,
        repo: repo.repo,
        state: "open",
        head: `${repo.owner}:${contentConfig.stagingBranch}`,
        base: contentConfig.branch,
        per_page: 1,
      }
    );
    if (existingPrs.length > 0) {
      prUrl = existingPrs[0].html_url;
    }
  } catch {
    // Best-effort — we can still show the status without the PR URL.
  }

  return {
    state: "ahead",
    aheadBy: comparison.ahead_by,
    behindBy: comparison.behind_by,
    prUrl,
  };
}

export async function publishStagingToLive(author?: { name: string; email: string }): Promise<{
  prNumber: number;
  prUrl: string;
  alreadyExists: boolean;
}> {
  const client = getGitHubClient();
  if (!client) {
    throw new Error("GitHub credentials are not configured. Set GITHUB_TOKEN or GitHub App values.");
  }

  const repo = parseRepoSlug(contentConfig.repo);

  // Return an existing open PR if one already exists.
  const existingPrs = await requestGitHubGet<Array<{ number: number; html_url: string }>>(
    client,
    "GET /repos/{owner}/{repo}/pulls",
    {
      owner: repo.owner,
      repo: repo.repo,
      state: "open",
      head: `${repo.owner}:${contentConfig.stagingBranch}`,
      base: contentConfig.branch,
      per_page: 1,
    }
  );

  if (existingPrs.length > 0) {
    return {
      prNumber: existingPrs[0].number,
      prUrl: existingPrs[0].html_url,
      alreadyExists: true,
    };
  }

  const prBody = [
    `Publish staged content to live (\`${contentConfig.stagingBranch}\` → \`${contentConfig.branch}\`).`,
    "",
    `- Content repo: ${contentConfig.repo}`,
    author ? `- Requested by: ${author.name} <${author.email}>` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const pullRequest = await client.pulls.create({
    owner: repo.owner,
    repo: repo.repo,
    title: `Publish staged content to live`,
    body: prBody,
    head: contentConfig.stagingBranch,
    base: contentConfig.branch,
  });

  return {
    prNumber: pullRequest.data.number,
    prUrl: pullRequest.data.html_url,
    alreadyExists: false,
  };
}

export async function createContentPullRequest({
  title,
  path,
  content,
  commitMessage,
  prTitle,
  prBody,
  branchName,
  author,
  labels,
}: CreateContentPrInput) {
  const client = getGitHubClient();
  if (!client) {
    throw new Error("GitHub credentials are not configured. Set GITHUB_TOKEN or GitHub App values.");
  }

  const repo = parseRepoSlug(contentConfig.repo);
  const normalizedPath = normalizeRepoPath(path);
  const baseBranch = await ensureStagingBranch(client, repo);
  const baseSha = await getDefaultBranchSha(client, repo, baseBranch);

  await client.git.createRef({
    owner: repo.owner,
    repo: repo.repo,
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });

  const existingSha = await getExistingFileSha(client, repo, normalizedPath, baseBranch);

  await client.repos.createOrUpdateFileContents({
    owner: repo.owner,
    repo: repo.repo,
    path: normalizedPath,
    branch: branchName,
    message: commitMessage,
    content: toBase64(content),
    sha: existingSha,
    ...(author ? { author, committer: author } : {}),
  });

  const fullPrBody = author
    ? `${prBody}\n- Editor: ${author.name} <${author.email}>`
    : prBody;

  const pullRequest = await client.pulls.create({
    owner: repo.owner,
    repo: repo.repo,
    title: prTitle,
    body: fullPrBody,
    head: branchName,
    base: baseBranch,
  });

  if (labels && labels.length > 0) {
    try {
      await client.issues.addLabels({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: pullRequest.data.number,
        labels,
      });
    } catch {
      // Label application is best-effort; the PR was created successfully.
    }
  }

  return {
    title,
    path,
    branchName,
    prNumber: pullRequest.data.number,
    prUrl: pullRequest.data.html_url,
  };
}

export async function createContentPullRequestWithFiles({
  title,
  files,
  commitMessage,
  prTitle,
  prBody,
  branchName,
  author,
  labels,
}: CreateContentPrWithFilesInput) {
  if (files.length === 0) {
    throw new Error("At least one file is required to create a pull request.");
  }

  const client = getGitHubClient();
  if (!client) {
    throw new Error("GitHub credentials are not configured. Set GITHUB_TOKEN or GitHub App values.");
  }

  const repo = parseRepoSlug(contentConfig.repo);
  const baseBranch = await ensureStagingBranch(client, repo);
  const baseSha = await getDefaultBranchSha(client, repo, baseBranch);

  await client.git.createRef({
    owner: repo.owner,
    repo: repo.repo,
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });

  for (const file of files) {
    const normalizedPath = normalizeRepoPath(file.path);
    const existingSha = await getExistingFileSha(client, repo, normalizedPath, baseBranch);
    const content =
      file.encoding === "base64" ? file.content : toBase64(file.content);

    await client.repos.createOrUpdateFileContents({
      owner: repo.owner,
      repo: repo.repo,
      path: normalizedPath,
      branch: branchName,
      message: file.commitMessage ?? commitMessage,
      content,
      sha: existingSha,
      ...(author ? { author, committer: author } : {}),
    });
  }

  const fullPrBody = author
    ? `${prBody}\n- Editor: ${author.name} <${author.email}>`
    : prBody;

  const pullRequest = await client.pulls.create({
    owner: repo.owner,
    repo: repo.repo,
    title: prTitle,
    body: fullPrBody,
    head: branchName,
    base: baseBranch,
  });

  if (labels && labels.length > 0) {
    try {
      await client.issues.addLabels({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: pullRequest.data.number,
        labels,
      });
    } catch {
      // Label application is best-effort; the PR was created successfully.
    }
  }

  return {
    title,
    branchName,
    files: files.map((file) => normalizeRepoPath(file.path)),
    prNumber: pullRequest.data.number,
    prUrl: pullRequest.data.html_url,
  };
}

export async function listClubDrafts(): Promise<ClubListItem[]> {
  try {
    const entries = await getRepositoryDirectory("clubs");
    return entries
      .filter((entry) => entry.type === "file" && entry.name.endsWith(".md"))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => ({ clubId: entry.name.replace(/\.md$/, "") }) satisfies ClubListItem);
  } catch {
    return [];
  }
}

export async function getClubDraft(clubId: string): Promise<ClubInfoFormData | null> {
  const safeClubId = toSafeRepoPathSegment(clubId);
  if (!safeClubId) {
    return null;
  }

  const file = await getRepositoryFile(`clubs/${safeClubId}.md`, { nullOn404: true });
  if (file === null) {
    return null;
  }

  const parsed = matter(file);

  const rawAka = parsed.data.aka;
  const aka: string[] = Array.isArray(rawAka)
    ? rawAka.map(String).filter(Boolean)
    : [];

  return {
    clubId: safeClubId,
    name: String(parsed.data.name ?? ""),
    aka,
    web: String(parsed.data.web ?? ""),
    content: parsed.content.trim(),
  };
}

export async function listAllClubNameSet(): Promise<Set<string>> {
  const clubList = await listClubDrafts();
  const nameSet = new Set<string>();
  await Promise.all(
    clubList.map(async ({ clubId }) => {
      const club = await getClubDraft(clubId);
      if (club) {
        nameSet.add(club.name.trim().toLowerCase());
        for (const alias of club.aka) {
          if (alias.trim()) {
            nameSet.add(alias.trim().toLowerCase());
          }
        }
      }
    })
  );
  return nameSet;
}

export async function listChampionshipDrafts(): Promise<ChampionshipListItem[]> {
  const entries = await getRepositoryDirectory("championships", { nullOn404: true });
  if (!entries) {
    return [];
  }
  return entries
    .filter((entry) => entry.type === "file" && entry.name.endsWith(".md"))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(
      (entry) =>
        ({ championshipId: entry.name.replace(/\.md$/, "") }) satisfies ChampionshipListItem
    );
}

export async function getChampionshipDraft(
  championshipId: string
): Promise<ChampionshipInfoFormData | null> {
  const safeId = toSafeRepoPathSegment(championshipId);
  if (!safeId) {
    return null;
  }

  const file = await getRepositoryFile(`championships/${safeId}.md`, { nullOn404: true });
  if (!file) {
    return null;
  }

  const parsed = matter(file);

  const yearEntries: ChampionshipYearEntry[] = Object.entries(parsed.data)
    .filter(([key]) => /^\d{4}$/.test(key))
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, races]) => ({ year, races: String(races ?? "") }));

  return {
    championshipId: safeId,
    title: String(parsed.data.title ?? ""),
    yearEntries,
    content: parsed.content.trim(),
  };
}

export async function listLongDistanceDrafts(): Promise<LongDistanceListItem[]> {
  try {
    const entries = await getRepositoryDirectory("long-distance");
    return entries
      .filter((entry) => entry.type === "file" && entry.name.endsWith(".md"))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => ({ slug: entry.name.replace(/\.md$/, "") }) satisfies LongDistanceListItem);
  } catch {
    return [];
  }
}

export async function getLongDistanceDraft(slug: string): Promise<LongDistanceFormData | null> {
  const safeSlug = toSafeRepoPathSegment(slug);
  if (!safeSlug) {
    return null;
  }

  const file = await getRepositoryFile(`long-distance/${safeSlug}.md`, { nullOn404: true });
  if (file === null) {
    return null;
  }

  const parsed = matter(file);

  return {
    slug: safeSlug,
    title: String(parsed.data.title ?? ""),
    content: parsed.content.trim(),
  };
}

export async function listInfoDrafts(): Promise<InfoListItem[]> {
  try {
    const files = await getRepositoryFiles("info", ".md");

    return files
      .map((file) => {
        const filePath = file.path.replace(/^info\//, "");

        return { filePath } satisfies InfoListItem;
      })
      .sort((left, right) => left.filePath.localeCompare(right.filePath));
  } catch {
    return [];
  }
}

export async function getInfoDraft(filePath: string): Promise<InfoFormData | null> {
  const safeFilePath = toSafeRepoRelativeFilePath(filePath);
  if (!safeFilePath) {
    return null;
  }

  const targetPath = `info/${safeFilePath}`;
  const file = await getRepositoryFile(targetPath, { nullOn404: true });
  if (file === null) {
    return null;
  }

  return {
    filePath: safeFilePath,
    content: file.trim(),
  };
}

export type StagingPullRequest = {
  number: number;
  title: string;
  createdAt: string;
  htmlUrl: string;
  submitterName: string | null;
  submitterEmail: string | null;
};

export async function listOpenStagingPullRequests(): Promise<StagingPullRequest[]> {
  const client = getGitHubClient();
  if (!client) {
    throw new Error("GitHub credentials are not configured. Set GITHUB_TOKEN or GitHub App values.");
  }

  const repo = parseRepoSlug(contentConfig.repo);

  const prs = await client.request("GET /repos/{owner}/{repo}/pulls", {
    owner: repo.owner,
    repo: repo.repo,
    state: "open",
    base: contentConfig.stagingBranch,
    sort: "created",
    direction: "asc",
    per_page: 50,
  });

  return prs.data.map((pr) => {
    const editorLine = (pr.body ?? "").split("\n").find((line) => line.startsWith("- Editor:"));
    let submitterName: string | null = null;
    let submitterEmail: string | null = null;

    if (editorLine) {
      const match = editorLine.match(/^- Editor:\s+(.+?)\s+<(.+?)>$/);
      if (match) {
        submitterName = match[1] ?? null;
        submitterEmail = match[2] ?? null;
      }
    }

    return {
      number: pr.number,
      title: pr.title,
      createdAt: pr.created_at,
      htmlUrl: pr.html_url,
      submitterName,
      submitterEmail,
    };
  });
}

export async function mergePullRequest(pullNumber: number): Promise<{ sha: string }> {
  const client = getGitHubClient();
  if (!client) {
    throw new Error("GitHub credentials are not configured. Set GITHUB_TOKEN or GitHub App values.");
  }

  const repo = parseRepoSlug(contentConfig.repo);

  const result = await client.pulls.merge({
    owner: repo.owner,
    repo: repo.repo,
    pull_number: pullNumber,
    merge_method: "merge",
  });

  if (!result.data.merged) {
    throw new Error("The submission could not be accepted — it may have a conflict or may already be closed.");
  }

  return { sha: result.data.sha ?? "" };
}

export async function publishAndMergeToLive(
  author?: { name: string; email: string }
): Promise<{ prNumber: number; prUrl: string; sha: string }> {
  const { prNumber, prUrl } = await publishStagingToLive(author);
  const { sha } = await mergePullRequest(prNumber);
  return { prNumber, prUrl, sha };
}

