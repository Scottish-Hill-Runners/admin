import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";

const publicMinorCorrectionPayloadSchema = z.object({
  raceId: z.string().trim().min(1),
  year: z.string().trim().min(1),
  runnerPosition: z.string().trim().min(1).optional(),
  challengeQuestionId: z.string().trim().min(1),
  challengeAnswer: z.string().trim().min(1),
  authorityConfirmed: z.literal(true),
  changes: z
    .array(
      z.object({
        field: z.enum(["name", "category", "club", "notes"]),
        value: z.string().trim().min(1),
      })
    )
    .min(1),
});

function allowedOrigin(request: Request): string {
  const origin = request.headers.get("origin")?.trim();
  const configuredOrigins = (env.DOCUMENTS_API_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configuredOrigins.length === 0) return "*";
  return origin && configuredOrigins.includes(origin) ? origin : configuredOrigins[0];
}

function responseHeaders(request: Request): HeadersInit {
  const origin = allowedOrigin(request);
  return {
    "Access-Control-Allow-Origin": origin,
    ...(origin === "*" ? {} : { Vary: "Origin" }),
  };
}

/**
 * Public, unauthenticated entry point for browser-submitted result corrections.
 * Adds the shared webhook secret server-side before forwarding to /api/content-webhook,
 * so the secret never needs to be exposed to the client.
 */
export async function POST(request: Request) {
  const headers = responseHeaders(request);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400, headers });
  }

  const parsedPayload = publicMinorCorrectionPayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return NextResponse.json(
      { message: "Please double-check the correction details and try again." },
      { status: 400, headers }
    );
  }

  const webhookSecret = env.RESULTS_INBOX_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { message: "Publishing is not set up yet. Please contact an administrator." },
      { status: 500, headers }
    );
  }

  const { raceId, year, runnerPosition, changes } = parsedPayload.data;

  // "notes" is free-text context for reviewers, not a runner field to overwrite.
  const fieldChanges = changes.filter((change) => change.field !== "notes");
  const notes = changes.find((change) => change.field === "notes")?.value;

  if (fieldChanges.length === 0) {
    return NextResponse.json(
      { message: "At least one runner detail must be changed." },
      { status: 400, headers }
    );
  }

  const webhookResponse = await fetch(new URL("/api/content-webhook", request.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": webhookSecret,
    },
    body: JSON.stringify({
      contentType: "minor-correction",
      raceId,
      year,
      runnerPosition,
      changes: fieldChanges,
      changeText: notes,
    }),
  });

  const body = await webhookResponse.json().catch(() => ({}));
  return NextResponse.json(body, { status: webhookResponse.status, headers });
}

export function OPTIONS(request: Request) {
  const headers = responseHeaders(request);
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...headers,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
