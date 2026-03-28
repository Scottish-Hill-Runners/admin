"use server";

import matter from "gray-matter";
import { newsFormSchema, type NewsFormValues } from "@/lib/news-schema";
import { contentConfig } from "@/lib/content-config";
import { createContentPullRequest } from "@/lib/github";

export type NewsActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof NewsFormValues, string[]>>;
};

function buildNewsSlug(date: string, slugSuffix: string): string {
  const normalizedDate = date.trim();
  const normalizedSuffix = slugSuffix.trim();

  if (!normalizedSuffix) {
    return normalizedDate;
  }

  return `${normalizedDate}-${normalizedSuffix}`;
}

function buildNewsMarkdown(values: NewsFormValues): string {
  return matter.stringify(values.content.trim(), {
    title: values.title,
    date: values.date,
    excerpt: values.excerpt,
  });
}

export async function saveNewsDraft(
  _previousState: NewsActionState,
  formData: FormData
): Promise<NewsActionState> {
  const parsed = newsFormSchema.safeParse({
    title: formData.get("title"),
    date: formData.get("date"),
    slugSuffix: formData.get("slugSuffix"),
    excerpt: formData.get("excerpt"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields before continuing.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const values = parsed.data;
  const slug = buildNewsSlug(values.date, values.slugSuffix);

  try {
    const result = await createContentPullRequest({
      title: values.title,
      path: `news/${slug}.md`,
      content: buildNewsMarkdown(values),
      commitMessage: `Create news draft: ${values.title}`,
      prTitle: `News: ${values.title}`,
      prBody:
        `Automated draft created by SHR Admin.\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Path: news/${slug}.md\n` +
        `- Date: ${values.date}`,
      branchName: `shr-admin/news-${slug}`,
    });

    return {
      status: "success",
      message: `Opened PR #${result.prNumber}: ${result.prUrl}`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to create the GitHub pull request.",
    };
  }
}
