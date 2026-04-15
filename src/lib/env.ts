import { z } from "zod";

// Treat empty strings from .env files as absent (undefined) for optional fields.
const optStr = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().min(1).optional()
);

const envSchema = z.object({
  AUTH_SECRET: optStr,
  NEXTAUTH_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url().optional()),
  GITHUB_CLIENT_ID: optStr,
  GITHUB_CLIENT_SECRET: optStr,
  GOOGLE_CLIENT_ID: optStr,
  GOOGLE_CLIENT_SECRET: optStr,
  CONTENT_REPO: z.string().min(1).default("Scottish-Hill-Runners/contents"),
  CONTENT_BRANCH: z.string().min(1).default("main"),
  GITHUB_TOKEN: optStr,
  GITHUB_APP_ID: optStr,
  GITHUB_APP_PRIVATE_KEY: optStr,
  GITHUB_APP_INSTALLATION_ID: optStr,
});

export const env = envSchema.parse({
  AUTH_SECRET: process.env.AUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  CONTENT_REPO: process.env.CONTENT_REPO,
  CONTENT_BRANCH: process.env.CONTENT_BRANCH,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GITHUB_APP_ID: process.env.GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
  GITHUB_APP_INSTALLATION_ID: process.env.GITHUB_APP_INSTALLATION_ID,
});
