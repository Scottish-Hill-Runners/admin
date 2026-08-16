import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getDocumentsSnapshot } from "@/lib/cloudinary-documents";

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
    "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
  };
}

export async function GET(request: Request) {
  try {
    const snapshot = await getDocumentsSnapshot();
    return NextResponse.json(snapshot, { headers: responseHeaders(request) });
  } catch {
    return NextResponse.json(
      { version: 1, refreshedAt: null, stale: true, documents: [], message: "Documents are temporarily unavailable." },
      { status: 503, headers: responseHeaders(request) }
    );
  }
}

export function OPTIONS(request: Request) {
  const headers = responseHeaders(request);
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...headers,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
