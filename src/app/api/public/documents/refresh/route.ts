import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getDocumentsSnapshot } from "@/lib/cloudinary-documents";

function hasValidSecret(request: Request): boolean {
  const expected = env.DOCUMENTS_REFRESH_SECRET;
  const provided = request.headers.get("x-documents-refresh-secret")?.trim() ?? "";
  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export async function POST(request: Request) {
  if (!hasValidSecret(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await getDocumentsSnapshot({ forceRefresh: true });
    return NextResponse.json({
      status: "ok",
      refreshedAt: snapshot.refreshedAt,
      documents: snapshot.documents.length,
    });
  } catch {
    return NextResponse.json(
      { status: "error", message: "Could not refresh the document list." },
      { status: 502 }
    );
  }
}
