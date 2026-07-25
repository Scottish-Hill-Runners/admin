import { z } from "zod";

// Treat empty strings from .env files as absent (undefined) for optional fields.
const optStr = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().min(1).optional()
);

const boolWithDefaultFalse = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}, z.boolean());

const envSchema = z
  .object({
  AUTH_SECRET: optStr,
  NEXTAUTH_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url().optional()),
  GITHUB_CLIENT_ID: optStr,
  GITHUB_CLIENT_SECRET: optStr,
  GOOGLE_CLIENT_ID: optStr,
  GOOGLE_CLIENT_SECRET: optStr,
  MICROSOFT_ENTRA_ID_CLIENT_ID: optStr,
  MICROSOFT_ENTRA_ID_CLIENT_SECRET: optStr,
  MICROSOFT_ENTRA_ID_TENANT_ID: optStr,
  RESEND_API_KEY: optStr,
  EMAIL_FROM: optStr,
  CONTENT_REPO: z.string().min(1).default("Scottish-Hill-Runners/contents"),
  CONTENT_BRANCH: z.string().min(1).default("main"),
  CONTENT_STAGING_BRANCH: z.string().min(1).default("staging"),
  CLOUDINARY_CLOUD_NAME: optStr,
  CLOUDINARY_API_KEY: optStr,
  CLOUDINARY_API_SECRET: optStr,
  GITHUB_TOKEN: optStr,
  GITHUB_APP_ID: optStr,
  GITHUB_APP_PRIVATE_KEY: optStr,
  GITHUB_APP_INSTALLATION_ID: optStr,
  FACEBOOK_PAGE_ID: optStr,
  FACEBOOK_PAGE_ACCESS_TOKEN: optStr,
  PUBLIC_SITE_BASE_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url().optional()),
  GITHUB_DEBUG_PERF: boolWithDefaultFalse,
  PUBLISHER_EMAILS: optStr,
  RESULTS_INBOX_RESEND_WEBHOOK_SECRET: optStr,
  RESULTS_INBOX_CRON_SECRET: optStr,
  RESULTS_INBOX_CALENDAR_URL: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.url().default("https://beta.scottishhillrunners.uk/calendar.json.gz")
  ),
  RESULTS_INBOX_STATE_PATH: z.string().min(1).default("_admin/results-inbox.json"),
  })
  .superRefine((value, ctx) => {
    if (value.CONTENT_BRANCH === value.CONTENT_STAGING_BRANCH) {
      ctx.addIssue({
        code: "custom",
        path: ["CONTENT_STAGING_BRANCH"],
        message:
          "CONTENT_STAGING_BRANCH must be different from CONTENT_BRANCH to keep draft submissions off the live branch.",
      });
    }

    const hasAnyFacebookConfig =
      Boolean(value.FACEBOOK_PAGE_ID) || Boolean(value.FACEBOOK_PAGE_ACCESS_TOKEN);
    const hasAllFacebookConfig =
      Boolean(value.FACEBOOK_PAGE_ID) && Boolean(value.FACEBOOK_PAGE_ACCESS_TOKEN);

    if (hasAnyFacebookConfig && !hasAllFacebookConfig) {
      ctx.addIssue({
        code: "custom",
        path: ["FACEBOOK_PAGE_ACCESS_TOKEN"],
        message:
          "FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN must both be set when Facebook posting is enabled.",
      });
    }

    if (hasAllFacebookConfig && !value.PUBLIC_SITE_BASE_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["PUBLIC_SITE_BASE_URL"],
        message:
          "PUBLIC_SITE_BASE_URL must be set when Facebook posting is enabled so links can use full live URLs.",
      });
    }
  });

export const env = envSchema.parse({
  AUTH_SECRET: process.env.AUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  MICROSOFT_ENTRA_ID_CLIENT_ID: process.env.MICROSOFT_ENTRA_ID_CLIENT_ID,
  MICROSOFT_ENTRA_ID_CLIENT_SECRET: process.env.MICROSOFT_ENTRA_ID_CLIENT_SECRET,
  MICROSOFT_ENTRA_ID_TENANT_ID: process.env.MICROSOFT_ENTRA_ID_TENANT_ID,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  CONTENT_REPO: process.env.CONTENT_REPO,
  CONTENT_BRANCH: process.env.CONTENT_BRANCH,
  CONTENT_STAGING_BRANCH: process.env.CONTENT_STAGING_BRANCH,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GITHUB_APP_ID: process.env.GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
  GITHUB_APP_INSTALLATION_ID: process.env.GITHUB_APP_INSTALLATION_ID,
  FACEBOOK_PAGE_ID: process.env.FACEBOOK_PAGE_ID,
  FACEBOOK_PAGE_ACCESS_TOKEN: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
  PUBLIC_SITE_BASE_URL: process.env.PUBLIC_SITE_BASE_URL,
  GITHUB_DEBUG_PERF: process.env.GITHUB_DEBUG_PERF,
  PUBLISHER_EMAILS: process.env.PUBLISHER_EMAILS,
  RESULTS_INBOX_WEBHOOK_SECRET: process.env.RESULTS_INBOX_WEBHOOK_SECRET,
  RESULTS_INBOX_RESEND_WEBHOOK_SECRET: process.env.RESULTS_INBOX_RESEND_WEBHOOK_SECRET,
  RESULTS_INBOX_CRON_SECRET: process.env.RESULTS_INBOX_CRON_SECRET,
  RESULTS_INBOX_CALENDAR_URL: process.env.RESULTS_INBOX_CALENDAR_URL,
  RESULTS_INBOX_STATE_PATH: process.env.RESULTS_INBOX_STATE_PATH,
});
