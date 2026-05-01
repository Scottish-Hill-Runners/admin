import { env } from "@/lib/env";

export const contentConfig = {
  repo: env.CONTENT_REPO,
  branch: env.CONTENT_BRANCH,
  stagingBranch: env.CONTENT_STAGING_BRANCH,
  sections: ["news", "races", "clubs", "info", "long-distance"] as const,
};

export type ContentSection = (typeof contentConfig.sections)[number];
