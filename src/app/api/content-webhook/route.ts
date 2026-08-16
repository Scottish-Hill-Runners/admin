import { NextResponse } from "next/server";
import { z } from "zod";
import { contentConfig } from "@/lib/content-config";
import { env } from "@/lib/env";
import { buildWebhookMarkdownDocument } from "@/lib/content-webhook";
import {
  getContentFileAtRef,
  isGitHubAccessError,
  upsertContentPullRequest,
  upsertContentPullRequestWithFiles,
} from "@/lib/github";
import { buildResultsWebhookDraftFiles, parseMinorCorrectionPayload, queueAndApplyMinorCorrection } from "@/lib/results-inbox";

const contentWebhookPayloadSchema = z.object({
  type: z.enum(["club", "race", "results", "minor-correction"]).optional(),
  contentType: z.enum(["club", "race", "results", "minor-correction"]).optional(),
  clubId: z.string().trim().min(1).optional(),
  raceId: z.string().trim().min(1).optional(),
  year: z.string().trim().min(1).optional(),
  id: z.string().trim().min(1).optional(),
  markdown: z.string().optional(),
  content: z.string().optional(),
  body: z.string().optional(),
  csvText: z.string().optional(),
  csv: z.string().optional(),
  reportMarkdown: z.string().optional(),
  generateReport: z.boolean().optional(),
  reportTitle: z.string().trim().min(1).optional(),
  reportDate: z.string().trim().min(1).optional(),
  frontmatter: z.record(z.string(), z.unknown()).optional(),
  frontmatterUpdates: z.record(z.string(), z.unknown()).optional(),
  runnerPosition: z.string().trim().min(1).optional(),
  runnerName: z.string().trim().min(1).optional(),
  runnerCategory: z.string().trim().min(1).optional(),
  runnerClub: z.string().trim().min(1).optional(),
  changeText: z.string().optional(),
  changes: z
    .array(
      z.object({
        field: z.enum(["name", "position", "category", "club"]),
        value: z.string().trim().min(1),
      })
    )
    .optional(),
});

function toBranchSafeSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function verifyWebhookSecret(request: Request): void {
  const expectedSecret = env.RESULTS_INBOX_WEBHOOK_SECRET;
  if (!expectedSecret) {
    throw new Error("RESULTS_INBOX_WEBHOOK_SECRET is not configured.");
  }

  const headerSecret = request.headers.get("x-webhook-secret")?.trim();
  const authHeader = request.headers.get("authorization")?.trim();
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const providedSecret = headerSecret || bearerSecret;

  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new Error("Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
   verifyWebhookSecret(request);
  } catch {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const parsedPayload = contentWebhookPayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return NextResponse.json({ message: "Unsupported payload shape." }, { status: 400 });
  }

  const contentType = parsedPayload.data.contentType ?? parsedPayload.data.type;
  const idValue = parsedPayload.data.clubId ?? parsedPayload.data.raceId ?? parsedPayload.data.id;
  const markdownContent = parsedPayload.data.markdown ?? parsedPayload.data.content ?? parsedPayload.data.body ?? "";
  const frontmatterUpdates = parsedPayload.data.frontmatterUpdates ?? parsedPayload.data.frontmatter ?? {};

  if (!contentType) {
    return NextResponse.json({ message: "A content type is required." }, { status: 400 });
  }

  if (contentType === "results") {
    const raceIdValue = parsedPayload.data.raceId ?? parsedPayload.data.id;
    const yearValue = parsedPayload.data.year;
    const csvText = parsedPayload.data.csvText ?? parsedPayload.data.csv ?? "";

    if (!raceIdValue || !yearValue) {
      return NextResponse.json({ message: "A race ID and year are required for results submissions." }, { status: 400 });
    }

    if (!csvText.trim()) {
      return NextResponse.json({ message: "CSV content is required for results submissions." }, { status: 400 });
    }

    try {
      const draftFiles = await buildResultsWebhookDraftFiles({
        raceId: raceIdValue,
        year: yearValue,
        csvText,
        reportMarkdown: parsedPayload.data.reportMarkdown,
        generateReport: parsedPayload.data.generateReport,
        reportTitle: parsedPayload.data.reportTitle,
        reportDate: parsedPayload.data.reportDate,
      });

      const result = await upsertContentPullRequestWithFiles({
        title: `Results update: ${raceIdValue} ${yearValue}`,
        files: draftFiles,
        commitMessage: `Update results: ${raceIdValue} ${yearValue}`,
        prTitle: `Results: ${raceIdValue} ${yearValue}`,
        prBody:
          `Prepared from a webhook submission.\n\n` +
          `- Content repo: ${contentConfig.repo}\n` +
          `- Race: ${raceIdValue}\n` +
          `- Year: ${yearValue}\n` +
          `- Source: webhook`,
        branchName: `shr-admin/results-${toBranchSafeSegment(raceIdValue)}-${toBranchSafeSegment(yearValue)}`,
      });

      return NextResponse.json({
        status: "draft-created",
        path: draftFiles[0]?.path,
        paths: draftFiles.map((file) => file.path),
        branchName: result.branchName,
        submissionNumber: result.prNumber,
        submissionUrl: result.prUrl,
      });
    } catch (error) {
      if (isGitHubAccessError(error)) {
        return NextResponse.json(
          {
            status: "needs-checking",
            message: "Publishing is not set up yet. Please contact an administrator.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          status: "needs-checking",
          message: error instanceof Error ? error.message : "Failed to create this draft.",
        },
        { status: 500 }
      );
    }
  }

  if (contentType === "minor-correction") {
    const correctionRequest = parseMinorCorrectionPayload({
      type: "minor-correction",
      raceId: parsedPayload.data.raceId ?? parsedPayload.data.id,
      year: parsedPayload.data.year,
      runnerName: parsedPayload.data.runnerName,
      runnerPosition: parsedPayload.data.runnerPosition,
      runnerCategory: parsedPayload.data.runnerCategory,
      runnerClub: parsedPayload.data.runnerClub,
      changeText: parsedPayload.data.changeText,
      changes: parsedPayload.data.changes,
    });

    if (!correctionRequest) {
      return NextResponse.json(
        { message: "A race ID, year, and at least one change are required for correction submissions." },
        { status: 400 }
      );
    }

    const result = await queueAndApplyMinorCorrection({
      source: "webhook",
      correctionRequest,
    });

    return NextResponse.json(result);
  }

  if (!idValue) {
    return NextResponse.json({ message: "A content type and ID are required." }, { status: 400 });
  }

  const trimmedMarkdown = markdownContent.trim();
  if (!trimmedMarkdown) {
    return NextResponse.json({ message: "Markdown content is required." }, { status: 400 });
  }

  let path: string;
  switch (contentType) {
    case "club":
      path = `clubs/${idValue}.md`;
      break;
    case "race":
      path = `races/${idValue}/index.md`;
      break;
    default:
      return NextResponse.json({ message: "Unsupported content type." }, { status: 400 });
  }

  try {
    const existingContent = await getContentFileAtRef(path, contentConfig.stagingBranch, { nullOn404: true });
    const preparedDocument = buildWebhookMarkdownDocument({
      existingContent: existingContent ?? undefined,
      markdownContent: trimmedMarkdown,
      frontmatterUpdates,
    });

    const result = await upsertContentPullRequest({
      title: contentType === "club" ? `Club info update: ${idValue}` : `Race info update: ${idValue}`,
      path,
      content: preparedDocument.content,
      commitMessage: contentType === "club" ? `Update club info: ${idValue}` : `Update race info: ${idValue}`,
      prTitle: contentType === "club" ? `Club info: ${idValue}` : `Race info: ${idValue}`,
      prBody:
        `Prepared from a webhook submission.\n\n` +
        `- Content repo: ${contentConfig.repo}\n` +
        `- Path: ${path}\n` +
        `- Source: webhook`,
      branchName: `shr-admin/${contentType}-${toBranchSafeSegment(idValue)}`,
    });

    return NextResponse.json({
      status: "draft-created",
      path,
      branchName: result.branchName,
      submissionNumber: result.prNumber,
      submissionUrl: result.prUrl,
    });
  } catch (error) {
    if (isGitHubAccessError(error)) {
      return NextResponse.json(
        {
          status: "needs-checking",
          message: "Publishing is not set up yet. Please contact an administrator.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        status: "needs-checking",
        message: error instanceof Error ? error.message : "Failed to create this draft.",
      },
      { status: 500 }
    );
  }
}
