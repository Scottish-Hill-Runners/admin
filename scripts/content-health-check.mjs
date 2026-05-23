import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

const DEFAULT_CONTENT_REPO = "Scottish-Hill-Runners/contents";
const DEFAULT_CONTENT_BRANCH = "main";
const DEFAULT_CONTENT_STAGING_BRANCH = "staging";

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const fileText = fs.readFileSync(filePath, "utf8");
  for (const rawLine of fileText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function bootstrapEnv() {
  const repoRoot = process.cwd();
  loadDotEnvFile(path.join(repoRoot, ".env.local"));
  loadDotEnvFile(path.join(repoRoot, ".env"));
}

function parseRepoSlug(repoSlug) {
  const [owner, repo] = String(repoSlug).split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repository slug: ${repoSlug}`);
  }

  return { owner, repo };
}

function toStatusLine(status, title, message) {
  return `${status.padEnd(6)} ${title.padEnd(16)} ${message}`;
}

function getErrorStatus(error) {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const status = error.status;
  if (typeof status === "number") {
    return status;
  }

  if (typeof status === "string") {
    const parsed = Number.parseInt(status, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const responseStatus = error.response?.status;
  if (typeof responseStatus === "number") {
    return responseStatus;
  }

  if (typeof responseStatus === "string") {
    const parsed = Number.parseInt(responseStatus, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function createGitHubClient(env) {
  if (env.GITHUB_TOKEN) {
    return {
      client: new Octokit({ auth: env.GITHUB_TOKEN }),
      authMode: "token",
    };
  }

  if (env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY && env.GITHUB_APP_INSTALLATION_ID) {
    return {
      client: new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: env.GITHUB_APP_ID,
          privateKey: env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
          installationId: env.GITHUB_APP_INSTALLATION_ID,
        },
      }),
      authMode: "app",
    };
  }

  return null;
}

async function runCheck(checks, key, run, options = {}) {
  try {
    await run();
    checks[key] = {
      status: "ok",
      message: options.okMessage ?? "ok",
    };
    return;
  } catch (error) {
    const status = getErrorStatus(error);
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : options.errorMessage ?? "failed";

    checks[key] = {
      status: options.allow404 && status === 404 ? "warning" : "error",
      message,
      ...(typeof status === "number" ? { httpStatus: status } : {}),
    };
  }
}

export async function runContentHealthCheck() {
  bootstrapEnv();

  const env = {
    CONTENT_REPO: process.env.CONTENT_REPO || DEFAULT_CONTENT_REPO,
    CONTENT_BRANCH: process.env.CONTENT_BRANCH || DEFAULT_CONTENT_BRANCH,
    CONTENT_STAGING_BRANCH:
      process.env.CONTENT_STAGING_BRANCH || DEFAULT_CONTENT_STAGING_BRANCH,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
    GITHUB_APP_INSTALLATION_ID: process.env.GITHUB_APP_INSTALLATION_ID,
  };

  const checks = {
    credentials: { status: "ok", message: "GitHub credentials are configured." },
    repository: { status: "ok", message: "Content repository is reachable." },
    liveBranch: {
      status: "ok",
      message: `Live branch (${env.CONTENT_BRANCH}) is reachable.`,
    },
    stagingBranch: {
      status: "ok",
      message: `Draft branch (${env.CONTENT_STAGING_BRANCH}) is reachable.`,
    },
    pullRequestsApi: {
      status: "ok",
      message: "Pull request listing endpoint is reachable.",
    },
  };

  if (env.CONTENT_BRANCH === env.CONTENT_STAGING_BRANCH) {
    checks.stagingBranch = {
      status: "error",
      message:
        "CONTENT_STAGING_BRANCH must be different from CONTENT_BRANCH to keep draft updates separate.",
    };
  }

  const auth = createGitHubClient(env);
  if (!auth) {
    checks.credentials = {
      status: "error",
      message: "GitHub credentials are not configured. Set GITHUB_TOKEN or GitHub App values.",
    };

    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      repo: env.CONTENT_REPO,
      branch: env.CONTENT_BRANCH,
      stagingBranch: env.CONTENT_STAGING_BRANCH,
      authMode: "none",
      checks,
    };
  }

  const { client, authMode } = auth;
  const repo = parseRepoSlug(env.CONTENT_REPO);

  await runCheck(checks, "repository", async () => {
    await client.request("GET /repos/{owner}/{repo}", {
      owner: repo.owner,
      repo: repo.repo,
    });
  });

  await runCheck(checks, "liveBranch", async () => {
    await client.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
      owner: repo.owner,
      repo: repo.repo,
      ref: `heads/${env.CONTENT_BRANCH}`,
    });
  });

  await runCheck(
    checks,
    "stagingBranch",
    async () => {
      await client.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
        owner: repo.owner,
        repo: repo.repo,
        ref: `heads/${env.CONTENT_STAGING_BRANCH}`,
      });
    },
    {
      allow404: true,
      errorMessage: "Could not reach draft branch ref.",
    }
  );

  await runCheck(checks, "pullRequestsApi", async () => {
    await client.request("GET /repos/{owner}/{repo}/pulls", {
      owner: repo.owner,
      repo: repo.repo,
      state: "open",
      base: env.CONTENT_STAGING_BRANCH,
      per_page: 1,
      page: 1,
    });
  });

  const hasErrors = Object.values(checks).some((check) => check.status === "error");

  return {
    ok: !hasErrors,
    checkedAt: new Date().toISOString(),
    repo: env.CONTENT_REPO,
    branch: env.CONTENT_BRANCH,
    stagingBranch: env.CONTENT_STAGING_BRANCH,
    authMode,
    checks,
  };
}

export function printContentHealthCheckReport(report) {
  const header = report.ok ? "Content store health: OK" : "Content store health: FAILED";
  console.log(header);
  console.log(`Checked at: ${report.checkedAt}`);
  console.log(`Repository: ${report.repo}`);
  console.log(`Live branch: ${report.branch}`);
  console.log(`Draft branch: ${report.stagingBranch}`);
  console.log(`Auth mode: ${report.authMode}`);
  console.log("");

  for (const [key, check] of Object.entries(report.checks)) {
    const status = check.status === "ok" ? "[OK]" : check.status === "warning" ? "[WARN]" : "[ERR]";
    const statusMessage =
      check.httpStatus !== undefined
        ? `${check.message} (HTTP ${check.httpStatus})`
        : check.message;
    console.log(toStatusLine(status, key, statusMessage));
  }
}

async function main() {
  const report = await runContentHealthCheck();
  printContentHealthCheckReport(report);
  process.exitCode = report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("Health check failed to run:", error);
    process.exitCode = 1;
  });
}
