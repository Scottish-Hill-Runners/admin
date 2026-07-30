import { NextResponse } from "next/server";
import { Resend } from "resend";
import * as XLSX from "xlsx";
import { z } from "zod";
import { env } from "@/lib/env";
import {
  enqueueMinorCorrectionCandidate,
  enqueueResultsInboxCandidate,
  parseMinorCorrectionEmail,
} from "@/lib/results-inbox";
import {
  countRecognizedRaceResultsHeaders,
  normalizeRaceResultsCsv,
  splitCsvLine,
  validateRaceResultsCsv,
} from "@/lib/results-csv";

const receivedAttachmentSchema = z.object({
  id: z.string().min(1),
  filename: z.string().nullable().optional(),
  content_type: z.string().optional(),
});

const receivedEmailEventSchema = z.object({
  type: z.literal("email.received"),
  data: z.object({
    email_id: z.string().min(1),
    created_at: z.string().optional(),
    from: z.string().optional(),
    subject: z.string().optional(),
    message_id: z.string().optional(),
    attachments: z.array(receivedAttachmentSchema).optional(),
  }),
});

type WebhookAttachment = z.infer<typeof receivedAttachmentSchema>;

function getResendClient(): Resend {
  return new Resend(env.RESEND_API_KEY ?? "re_placeholder");
}

function readWebhookHeader(request: Request, keys: string[]): string {
  for (const key of keys) {
    const value = request.headers.get(key)?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function getWebhookSignatureHeaders(request: Request): {
  id: string;
  timestamp: string;
  signature: string;
} {
  return {
    id: readWebhookHeader(request, ["webhook-id", "svix-id"]),
    timestamp: readWebhookHeader(request, ["webhook-timestamp", "svix-timestamp"]),
    signature: readWebhookHeader(request, ["webhook-signature", "svix-signature"]),
  };
}

function isCsvAttachment(attachment: WebhookAttachment): boolean {
  const lowerName = (attachment.filename ?? "").toLowerCase();
  const lowerMime = (attachment.content_type ?? "").toLowerCase();
  return lowerName.endsWith(".csv") || lowerMime === "text/csv" || lowerMime === "application/csv";
}

function isXlsxAttachment(attachment: WebhookAttachment): boolean {
  const lowerName = (attachment.filename ?? "").toLowerCase();
  const lowerMime = (attachment.content_type ?? "").toLowerCase();
  return (
    lowerName.endsWith(".xlsx") ||
    lowerMime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

function isOdsAttachment(attachment: WebhookAttachment): boolean {
  const lowerName = (attachment.filename ?? "").toLowerCase();
  const lowerMime = (attachment.content_type ?? "").toLowerCase();
  return (
    lowerName.endsWith(".ods") ||
    lowerMime === "application/vnd.oasis.opendocument.spreadsheet"
  );
}

function countDataRows(csvText: string): number {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length <= 1) {
    return 0;
  }

  return lines.length - 1;
}

function scoreWorksheetCsv(csvText: string, sheetName: string): number {
  const normalizedCsv = normalizeRaceResultsCsv(csvText);
  const lines = normalizedCsv
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  const firstLine = lines[0] ?? "";
  const headerValues = firstLine ? splitCsvLine(firstLine) : [];
  const issues = validateRaceResultsCsv(normalizedCsv);

  const errorCount = issues.filter((issue) => issue.level === "error").length;
  const warningCount = issues.filter((issue) => issue.level === "warning").length;
  const recognizedHeaderCount = countRecognizedRaceResultsHeaders(headerValues);
  const dataRowCount = countDataRows(normalizedCsv);
  const sheetNameSignal = /result|finish|times?/i.test(sheetName) ? 3 : 0;

  return (
    recognizedHeaderCount * 12 +
    Math.min(dataRowCount, 600) * 0.06 +
    sheetNameSignal -
    errorCount * 25 -
    warningCount * 4
  );
}

type WorksheetScore = {
  sheetName: string;
  score: number;
  errorCount: number;
  warningCount: number;
  recognizedHeaderCount: number;
  dataRowCount: number;
};

function decodeCsvAttachment(binary: Uint8Array, fileName: string): string {
  const csvText = Buffer.from(binary).toString("utf8");
  const normalizedCsv = normalizeRaceResultsCsv(csvText);
  if (!normalizedCsv.trim()) {
    throw new Error(`Attachment ${fileName} is empty.`);
  }

  return normalizedCsv;
}

function decodeXlsxAttachment(
  binary: Uint8Array,
  fileName: string
): { csvText: string; selectedWorksheet: string; worksheetScores: WorksheetScore[] } {
  const workbook = XLSX.read(binary, { type: "array" });
  const scoredSheets = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rawCsv = XLSX.utils.sheet_to_csv(worksheet, { blankrows: false });
    const normalizedCsv = normalizeRaceResultsCsv(rawCsv);

    const lines = normalizedCsv
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0);
    const firstLine = lines[0] ?? "";
    const headerValues = firstLine ? splitCsvLine(firstLine) : [];
    const issues = validateRaceResultsCsv(normalizedCsv);
    const errorCount = issues.filter((issue) => issue.level === "error").length;
    const warningCount = issues.filter((issue) => issue.level === "warning").length;
    const recognizedHeaderCount = countRecognizedRaceResultsHeaders(headerValues);
    const dataRowCount = countDataRows(normalizedCsv);

    return {
      sheetName,
      score: scoreWorksheetCsv(normalizedCsv, sheetName),
      errorCount,
      warningCount,
      recognizedHeaderCount,
      dataRowCount,
      normalizedCsv,
    };
  }).filter((candidate) => candidate.normalizedCsv.trim().length > 0);

  if (scoredSheets.length === 0) {
    throw new Error(`Workbook ${fileName} does not contain usable worksheets.`);
  }

  scoredSheets.sort((left, right) => right.score - left.score);
  return {
    csvText: scoredSheets[0].normalizedCsv,
    selectedWorksheet: scoredSheets[0].sheetName,
    worksheetScores: scoredSheets.map((sheet) => ({
      sheetName: sheet.sheetName,
      score: sheet.score,
      errorCount: sheet.errorCount,
      warningCount: sheet.warningCount,
      recognizedHeaderCount: sheet.recognizedHeaderCount,
      dataRowCount: sheet.dataRowCount,
    })),
  };
}

function parseRaceHints(subject: string, bodyText: string, fileName: string): { raceId?: string; year?: string } {
  const combined = `${subject}\n${bodyText}`;
  const yearMatch = combined.match(/\b(19\d{2}|20\d{2})(\*)?\b/);
  const raceIdMatch = combined.match(/\brace[\s_-]*id\s*[:=]\s*([A-Za-z0-9-]+)\b/i);
  const fileYearMatch = fileName.trim().match(/\b(19\d{2}|20\d{2})(\*)?\b/);

  return {
    raceId: raceIdMatch?.[1],
    year: yearMatch
      ? `${yearMatch[1]}${yearMatch[2] ?? ""}`
      : fileYearMatch
        ? `${fileYearMatch[1]}${fileYearMatch[2] ?? ""}`
        : undefined,
  };
}

async function fetchAttachmentBinary(
  resend: Resend,
  emailId: string,
  attachment: WebhookAttachment
): Promise<Uint8Array> {
  const attachmentResponse = await resend.emails.receiving.attachments.get({
    emailId,
    id: attachment.id,
  });

  if (!attachmentResponse.data?.download_url) {
    throw new Error(`Attachment ${attachment.filename ?? attachment.id} is unavailable.`);
  }

  const downloadResponse = await fetch(attachmentResponse.data.download_url);
  if (!downloadResponse.ok) {
    throw new Error(`Could not download attachment ${attachment.filename ?? attachment.id}.`);
  }

  const buffer = await downloadResponse.arrayBuffer();
  return new Uint8Array(buffer);
}

async function fetchIncomingEmailDetails(
  resend: Resend,
  event: z.infer<typeof receivedEmailEventSchema>
): Promise<{
  emailId: string;
  attachments: WebhookAttachment[];
  sender: string;
  subject: string;
  receivedAt: string;
  messageId: string;
  bodyText: string;
}> {
  const emailId = event.data.email_id;
  const receivingEmail = await resend.emails.receiving.get(emailId, { html_format: "cid" });
  if (!receivingEmail.data) {
    throw new Error(receivingEmail.error?.message ?? "Could not retrieve incoming email details.");
  }

  const sender = receivingEmail.data.from || event.data.from || "unknown@unknown";
  const subject = receivingEmail.data.subject || event.data.subject || "(no subject)";
  const receivedAt = receivingEmail.data.created_at || event.data.created_at || new Date().toISOString();
  const messageId = receivingEmail.data.message_id || event.data.message_id || emailId;
  const bodyText = receivingEmail.data.text ?? "";

  const attachments = receivingEmail.data.attachments ?? event.data.attachments ?? [];
  return {
    emailId,
    attachments,
    sender,
    subject,
    receivedAt,
    messageId,
    bodyText,
  };
}

async function extractBestCsvFromEmail(
  resend: Resend,
  email: Awaited<ReturnType<typeof fetchIncomingEmailDetails>>
): Promise<{
  csvText: string;
  fileName: string;
  sourceType: "csv" | "xlsx" | "ods";
  selectedWorksheet?: string;
  worksheetScores?: WorksheetScore[];
}> {
  const { attachments, emailId } = email;
  if (attachments.length === 0) {
    throw new Error("Incoming email has no attachments.");
  }

  const csvFirst = attachments.find((attachment) => isCsvAttachment(attachment));
  if (csvFirst) {
    const binary = await fetchAttachmentBinary(resend, emailId, csvFirst);
    return {
      csvText: decodeCsvAttachment(binary, csvFirst.filename ?? "results.csv"),
      fileName: csvFirst.filename ?? "results.csv",
      sourceType: "csv",
    };
  }

  const workbookAttachment = attachments.find(
    (attachment) => isXlsxAttachment(attachment) || isOdsAttachment(attachment)
  );
  if (!workbookAttachment) {
    throw new Error("No CSV, XLSX, or ODS attachment found.");
  }

  const binary = await fetchAttachmentBinary(resend, emailId, workbookAttachment);
  const decodedWorkbook = decodeXlsxAttachment(binary, workbookAttachment.filename ?? "results.xlsx");
  const sourceType = isOdsAttachment(workbookAttachment) ? "ods" : "xlsx";
  return {
    csvText: decodedWorkbook.csvText,
    fileName: workbookAttachment.filename ?? "results.xlsx",
    sourceType,
    selectedWorksheet: decodedWorkbook.selectedWorksheet,
    worksheetScores: decodedWorkbook.worksheetScores,
  };
}

function verifyResendWebhookEvent(requestBody: string, request: Request): unknown {
  const webhookSecret = env.RESULTS_INBOX_RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("RESULTS_INBOX_RESEND_WEBHOOK_SECRET is not configured.");
  }

  const headers = getWebhookSignatureHeaders(request);
  if (!headers.id || !headers.timestamp || !headers.signature) {
    throw new Error("Missing webhook signature headers.");
  }

  const resend = getResendClient();
  return resend.webhooks.verify({
    payload: requestBody,
    headers,
    webhookSecret,
  });
}

export async function POST(request: Request) {
  const rawPayload = await request.text();

  let verifiedEvent: unknown;
  try {
    verifiedEvent = verifyResendWebhookEvent(rawPayload, request);
  } catch {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const parsedEvent = receivedEmailEventSchema.safeParse(verifiedEvent);
  if (!parsedEvent.success) {
    return NextResponse.json({ message: "Unsupported webhook event payload." }, { status: 400 });
  }

  const resend = getResendClient();

  try {
    const email = await fetchIncomingEmailDetails(resend, parsedEvent.data);
    const correctionRequest = parseMinorCorrectionEmail(email.subject, email.bodyText);
    const hasSpreadsheetAttachment = email.attachments.some(
      (attachment) =>
        isCsvAttachment(attachment) || isXlsxAttachment(attachment) || isOdsAttachment(attachment)
    );

    if (correctionRequest && !hasSpreadsheetAttachment) {
      const queued = await enqueueMinorCorrectionCandidate({
        messageId: email.messageId,
        sender: email.sender,
        subject: email.subject,
        bodyText: email.bodyText,
        receivedAt: email.receivedAt,
        correctionRequest,
      });

      return NextResponse.json({
        status: queued.duplicate ? "duplicate" : "queued",
        candidateId: queued.candidate.id,
      });
    }

    const extracted = await extractBestCsvFromEmail(resend, email);

    const hints = parseRaceHints(email.subject, email.bodyText, extracted.fileName);
    const queued = await enqueueResultsInboxCandidate({
      messageId: email.messageId,
      sender: email.sender,
      subject: email.subject,
      bodyText: email.bodyText,
      receivedAt: email.receivedAt,
      fileName: extracted.fileName,
      sourceType: extracted.sourceType,
      selectedWorksheet: extracted.selectedWorksheet,
      worksheetScores: extracted.worksheetScores,
      csvText: extracted.csvText,
      raceId: hints.raceId,
      year: hints.year,
    });

    return NextResponse.json({
      status: queued.duplicate ? "duplicate" : "queued",
      candidateId: queued.candidate.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not queue this message right now.",
      },
      { status: 400 }
    );
  }
}
