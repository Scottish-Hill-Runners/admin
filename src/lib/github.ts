import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import matter from "gray-matter";
import { env } from "@/lib/env";
import { contentConfig } from "@/lib/content-config";
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
};

const githubGetCache = new Map<string, CachedGetEntry>();

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
  const decoded = decodeURIComponent(path);
  return decoded.replace(/^\/+/, "").replace(/^contents\/+/, "");
}

function buildGitHubGetCacheKey(route: string, params: Record<string, unknown>): string {
  const sortedEntries = Object.entries(params).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  return `${route}:${JSON.stringify(sortedEntries)}`;
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

  return null;
}

async function requestGitHubGet<T>(
  client: Octokit,
  route: string,
  params: Record<string, unknown>
): Promise<T> {
  const cacheKey = buildGitHubGetCacheKey(route, params);
  const cached = githubGetCache.get(cacheKey);

  const headers = cached?.etag ? { "if-none-match": cached.etag } : undefined;

  try {
    const response = await client.request(route, {
      ...params,
      headers,
    });

    const etagHeader = response.headers.etag;
    const etag = Array.isArray(etagHeader) ? etagHeader[0] : etagHeader;

    if (typeof etag === "string" && etag.length > 0) {
      githubGetCache.set(cacheKey, { etag, data: response.data });
    }

    return response.data as T;
  } catch (error) {
    if (getErrorStatus(error) === 304) {
      if (cached) {
        return cached.data as T;
      }

      // Defensive fallback: retry once without conditional headers if a 304 arrives without cache.
      const retryResponse = await client.request(route, params);
      const retryEtagHeader = retryResponse.headers.etag;
      const retryEtag = Array.isArray(retryEtagHeader)
        ? retryEtagHeader[0]
        : retryEtagHeader;

      if (typeof retryEtag === "string" && retryEtag.length > 0) {
        githubGetCache.set(cacheKey, { etag: retryEtag, data: retryResponse.data });
      }

      return retryResponse.data as T;
    }

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

async function getRepositoryFiles(path: string, extension: string) {
  const client = getGitHubClient();
  if (!client) {
    throw new Error("GitHub credentials are not configured. Set GITHUB_TOKEN or GitHub App values.");
  }

  const repo = parseRepoSlug(contentConfig.repo);
  const normalizedPath = normalizeRepoPath(path).replace(/\/+$/, "");
  const branchHeadSha = await getDefaultBranchSha(client, repo, contentConfig.branch);
  const commit = await requestGitHubGet<{ tree: { sha: string } }>(
    client,
    "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
    {
    owner: repo.owner,
    repo: repo.repo,
    commit_sha: branchHeadSha,
    }
  );

  const treeResponse = await requestGitHubGet<{
    tree: Array<{ type?: string; path?: string }>;
  }>(
    client,
    "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
    {
    owner: repo.owner,
    repo: repo.repo,
    tree_sha: commit.tree.sha,
    recursive: "1",
    }
  );

  return treeResponse.tree
    .filter(
      (entry) =>
        entry.type === "blob" &&
        typeof entry.path === "string" &&
        entry.path.startsWith(`${normalizedPath}/`) &&
        entry.path.endsWith(extension)
    )
    .map((entry) => {
      const relativePath = String(entry.path);
      const name = relativePath.split("/").pop();

      if (!name) {
        throw new Error(`Invalid repository path: ${relativePath}`);
      }

      return {
        name,
        path: relativePath,
      };
    });
}

export async function listNewsDrafts(): Promise<NewsListItem[]> {
  try {
    const markdownFiles = (await getRepositoryFiles("news", ".md"))
      .sort((left, right) => right.name.localeCompare(left.name))
      .slice(0, 24);

    const items = await Promise.all(
      markdownFiles.map(async (entry) => {
        const slug = entry.path.replace(/^news\//, "").replace(/\.md$/, "");
        const draft = await getNewsDraft(slug);

        return {
          slug,
          title: draft?.data.title || slug,
          date: draft?.data.date || "",
        } satisfies NewsListItem;
      })
    );

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

    const items = await Promise.all(
      directories.map(async (entry) => {
        const raceId = entry.name;
        const draft = await getRaceDraft(raceId);

        return {
          raceId,
          title: draft?.title || raceId,
          venue: draft?.venue || "",
        } satisfies RaceListItem;
      })
    );

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
    const file = await getRepositoryFile(`races/${raceId}/index.md`);
    const parsed = matter(file);

    return {
      raceId,
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
    const file = await getRepositoryFile(`races/${raceId}/${year}.csv`);
    const normalizedFile = file.replace(/\r\n?/g, "\n");

    return {
      raceId,
      year,
      csvText: normalizedFile.trim(),
    };
  } catch {
    return null;
  }
}

export async function listRaceResultsDrafts(raceId: string): Promise<RaceResultListItem[]> {
  try {
    const entries = await getRepositoryDirectory(`races/${raceId}`);

    return entries
      .filter((entry) => entry.type === "file" && entry.name.endsWith(".csv"))
      .map((entry) => ({
        raceId,
        year: entry.name.replace(/\.csv$/, ""),
        path: `races/${raceId}/${entry.name}`,
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

