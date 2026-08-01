import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  listResultsInboxCandidates,
  summarizeResultsInbox,
} from "@/lib/results-inbox";

function hasValidSecret(providedSecret: string): boolean {
  const expected = env.RESULTS_INBOX_CRON_SECRET;
  if (!expected) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(providedSecret);
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: Request) {
  const secretHeader = request.headers.get("x-results-inbox-cron-secret")?.trim() ?? "";
  if (!hasValidSecret(secretHeader)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const candidates = await listResultsInboxCandidates();
  const summary = summarizeResultsInbox(candidates);
  const oldestNeedsChecking = candidates
    .filter((candidate) => candidate.status === "error" || candidate.status === "queued")
    .at(-1)?.createdAt;

  return NextResponse.json({
    status: "ok",
    checkedAt: new Date().toISOString(),
    queued: summary.queued,
    draftCreated: summary.draftCreated,
    dismissed: summary.rejected,
    needsChecking: summary.needsChecking,
    oldestNeedsChecking,
  });
}
