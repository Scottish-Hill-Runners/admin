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

type CreateContentPrInput = {
  title: string;
  path: string;
  content: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  branchName: string;
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
  etag: string;
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
  }

  const headers = cached?.etag ? { "if-none-match": cached.etag } : undefined;

  try {
    const response = await client.request(route, {
      ...params,
      headers,
    });

    const etagHeader = response.headers.etag;
    const etag = Array.isArray(etagHeader) ? etagHeader[0] : etagHeader;

    if (typeof etag === "string" && etag.length > 0) {
      const now = Date.now();
      githubGetCache.set(cacheKey, {
        etag,
        data: response.data,
        cachedAt: now,
        lastAccessedAt: now,
      });
      pruneGitHubGetCache(now);
    }

    logGitHubPerf("request", {
      route,
      durationMs: Math.round((isGitHubPerfDebugEnabled() ? performance.now() : 0) - requestStartedPerf),
      cacheStatus: cached ? "etag-refresh" : "miss",
      approxResponseBytes: estimateApproxBytes(response.data),
    });
    logGitHubCacheSnapshotIfNeeded();

    return response.data as T;
  } catch (error) {
    if (getErrorStatus(error) === 304) {
      if (cached) {
        logGitHubPerf("request", {
          route,
          durationMs: Math.round((isGitHubPerfDebugEnabled() ? performance.now() : 0) - requestStartedPerf),
          cacheStatus: "revalidated-hit",
          approxResponseBytes: estimateApproxBytes(cached.data),
        });
        logGitHubCacheSnapshotIfNeeded();
        return cached.data as T;
      }

      // Defensive fallback: retry once without conditional headers if a 304 arrives without cache.
      const retryResponse = await client.request(route, params);
      const retryEtagHeader = retryResponse.headers.etag;
      const retryEtag = Array.isArray(retryEtagHeader)
        ? retryEtagHeader[0]
        : retryEtagHeader;

      if (typeof retryEtag === "string" && retryEtag.length > 0) {
        const now = Date.now();
        githubGetCache.set(cacheKey, {
          etag: retryEtag,
          data: retryResponse.data,
          cachedAt: now,
          lastAccessedAt: now,
        });
        pruneGitHubGetCache(now);
      }

      logGitHubPerf("request", {
        route,
        durationMs: Date.now() - requestStartedAt,
        cacheStatus: "revalidate-no-cache-retry",
        approxResponseBytes: estimateApproxBytes(retryResponse.data),
      });
      logGitHubCacheSnapshotIfNeeded();

      return retryResponse.data as T;
    }

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

async function getRepositoryFile(path: string) {
  const client = getGitHubClient();
  if (!client) {
    throw new Error("GitHub credentials are not configured. Set GITHUB_TOKEN or GitHub App values.");
  }

  const repo = parseRepoSlug(contentConfig.repo);
  const normalizedPath = normalizeRepoPath(path);
  const response = await requestGitHubGet<RepositoryDirectoryEntry[] | RepositoryFileEntry>(
    client,
    "GET /repos/{owner}/{repo}/contents/{path}",
    {
    owner: repo.owner,
    repo: repo.repo,
    path: normalizedPath,
    ref: contentConfig.branch,
    }
  );

  if (Array.isArray(response) || !("content" in response)) {
    throw new Error(`Expected a file at ${normalizedPath}`);
  }

  return fromBase64(response.content.replace(/\n/g, ""));
}

async function getRepositoryDirectory(path: string) {
  const client = getGitHubClient();
  if (!client) {
    throw new Error("GitHub credentials are not configured. Set GITHUB_TOKEN or GitHub App values.");
  }

  const repo = parseRepoSlug(contentConfig.repo);
  const normalizedPath = normalizeRepoPath(path);
  const response = await requestGitHubGet<RepositoryDirectoryEntry[] | RepositoryFileEntry>(
    client,
    "GET /repos/{owner}/{repo}/contents/{path}",
    {
    owner: repo.owner,
    repo: repo.repo,
    path: normalizedPath,
    ref: contentConfig.branch,
    }
  );

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
  try {
    const file = await getRepositoryFile(`news/${slug}.md`);
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
  } catch {
    return null;
  }
}

export async function getRaceDraft(raceId: string): Promise<RaceInfoFormData | null> {
  try {
    const safeRaceId = toSafeRepoPathSegment(raceId);
    if (!safeRaceId) {
      return null;
    }

    const file = await getRepositoryFile(`races/${safeRaceId}/index.md`);
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
  } catch {
    return null;
  }
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
  try {
    const safeRaceId = toSafeRepoPathSegment(raceId);
    const safeYear = toSafeRepoPathSegment(year);
    if (!safeRaceId || !safeYear) {
      return null;
    }

    const file = await getRepositoryFile(`races/${safeRaceId}/${safeYear}.csv`);
    const normalizedFile = file.replace(/\r\n?/g, "\n");

    return {
      raceId: safeRaceId,
      year: safeYear,
      csvText: normalizedFile.trim(),
    };
  } catch {
    return null;
  }
}

export async function listRaceResultsDrafts(raceId: string): Promise<RaceResultListItem[]> {
  try {
    const safeRaceId = toSafeRepoPathSegment(raceId);
    if (!safeRaceId) {
      return [];
    }

    const entries = await getRepositoryDirectory(`races/${safeRaceId}`);

    return entries
      .filter((entry) => entry.type === "file" && entry.name.endsWith(".csv"))
      .map((entry) => ({
        raceId: safeRaceId,
        year: entry.name.replace(/\.csv$/, ""),
        path: `races/${safeRaceId}/${entry.name}`,
      }))
      .sort((left, right) => right.year.localeCompare(left.year));
  } catch {
    return [];
  }
}

export async function createContentPullRequest({
  title,
  path,
  content,
  commitMessage,
  prTitle,
  prBody,
  branchName,
}: CreateContentPrInput) {
  const client = getGitHubClient();
  if (!client) {
    throw new Error("GitHub credentials are not configured. Set GITHUB_TOKEN or GitHub App values.");
  }

  const repo = parseRepoSlug(contentConfig.repo);
  const normalizedPath = normalizeRepoPath(path);
  const baseBranch = contentConfig.branch;
  const baseSha = await getDefaultBranchSha(client, repo, baseBranch);

  await client.git.createRef({
    owner: repo.owner,
    repo: repo.repo,
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });

  let existingSha: string | undefined;
  try {
    const existing = await requestGitHubGet<RepositoryDirectoryEntry[] | RepositoryFileEntry>(
      client,
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
      owner: repo.owner,
      repo: repo.repo,
      path: normalizedPath,
      ref: baseBranch,
      }
    );

    if (!Array.isArray(existing) && "sha" in existing) {
      existingSha = existing.sha;
    }
  } catch {
    existingSha = undefined;
  }

  await client.repos.createOrUpdateFileContents({
    owner: repo.owner,
    repo: repo.repo,
    path: normalizedPath,
    branch: branchName,
    message: commitMessage,
    content: toBase64(content),
    sha: existingSha,
  });

  const pullRequest = await client.pulls.create({
    owner: repo.owner,
    repo: repo.repo,
    title: prTitle,
    body: prBody,
    head: branchName,
    base: baseBranch,
  });

  return {
    title,
    path,
    branchName,
    prNumber: pullRequest.data.number,
    prUrl: pullRequest.data.html_url,
  };
}

