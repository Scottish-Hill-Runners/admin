import matter from "gray-matter";

export type WebhookMarkdownDocumentInput = {
  existingContent?: string | null;
  markdownContent: string;
  frontmatterUpdates?: Record<string, unknown>;
};

export type WebhookMarkdownDocumentResult = {
  content: string;
  frontmatter: Record<string, unknown>;
};

function normalizeFrontmatterValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.trim();
  }

  return value;
}

export function buildWebhookMarkdownDocument(input: WebhookMarkdownDocumentInput): WebhookMarkdownDocumentResult {
  const existingParsed = input.existingContent ? matter(input.existingContent) : null;
  const existingFrontmatter = (existingParsed?.data ?? {}) as Record<string, unknown>;

  const mergedFrontmatter = {
    ...existingFrontmatter,
    ...(input.frontmatterUpdates ?? {}),
  } as Record<string, unknown>;

  const cleanedFrontmatter = Object.fromEntries(
    Object.entries(mergedFrontmatter).map(([key, value]) => [key, normalizeFrontmatterValue(value)])
  );

  const bodyContent = input.markdownContent.trim();
  const finalContent = matter.stringify(bodyContent, cleanedFrontmatter);

  return {
    content: finalContent,
    frontmatter: cleanedFrontmatter,
  };
}
