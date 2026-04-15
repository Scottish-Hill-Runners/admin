"use server";

import matter from "gray-matter";
import { newsFormSchema, type NewsFormValues } from "@/lib/news-schema";
import { contentConfig } from "@/lib/content-config";
import {
  createContentPullRequest,
  listReservedNewsSlugSuffixes,
  suggestNewsSlugSuffixForDate,
} from "@/lib/github";
import {
  buildNewsSlug,
  isIsoNewsDate,
  suggestNextNewsSlugSuffix,
} from "@/lib/news-slug";

export type NewsActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof NewsFormValues, string[]>>;
};

export type NewsSuffixSuggestionState = {
  suffix: string;
  message?: string;
};

export async function suggestNewsSlugSuffixAction(
  date: string
): Promise<NewsSuffixSuggestionState> {
  const normalizedDate = String(date).trim();
  if (!isIsoNewsDate(normalizedDate)) {
    return { suffix: "" };
  }

  try {
    const suffix = await suggestNewsSlugSuffixForDate(normalizedDate);
    return { suffix };
  } catch {
    return {
      suffix: "",
      message: "Could not refresh the suffix suggestion. You can still enter one manually.",
    };
  }
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
  const year = values.date.slice(0, 4);
  const originalSlug = String(formData.get("originalSlug") ?? "").trim();
  const requestedSlug = buildNewsSlug(values.date, values.slugSuffix);
  const requestedPath = `news/${year}/${requestedSlug}.md`;
  const originalPath = originalSlug ? `news/${originalSlug}.md` : "";
  const isEditingCurrentPath = originalPath === requestedPath;

  const reservedSuffixes = await listReservedNewsSlugSuffixes(values.date);
  const requestedSuffix = values.slugSuffix.trim();

  let effectiveSuffix = requestedSuffix;
  if (!isEditingCurrentPath && reservedSuffixes.includes(requestedSuffix)) {
    if (requestedSuffix) {
      return {
        status: "error",
        message: "Please pick another suffix. This date/suffix is already reserved.",
        fieldErrors: {
          slugSuffix: ["This suffix is already used for the selected date."],
        },
      };
    }

    effectiveSuffix = suggestNextNewsSlugSuffix(reservedSuffixes);
  }

  const slug = buildNewsSlug(values.date, effectiveSuffix);
  const filePath = `news/${year}/${slug}.md`;
  const didAutoAssignSuffix = !requestedSuffix && effectiveSuffix.length > 0;

  try {
    const result = await createContentPullRequest({
      title: values.title,
      path: filePath,
      content: buildNewsMarkdown(values),
      commitMessage: `Create news draft: ${values.title}`,
      prTitle: `News: ${values.title}`,
      prBody:
        `Automated draft created by SHR Admin.\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Path: ${filePath}\n` +
        `- Date: ${values.date}`,
      branchName: `shr-admin/news-${year}-${slug}`,
    });

    return {
      status: "success",
      message: didAutoAssignSuffix
        ? `Opened PR #${result.prNumber}: ${result.prUrl} (suffix auto-set to ${effectiveSuffix})`
        : `Opened PR #${result.prNumber}: ${result.prUrl}`,
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
