import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/** HMAC-SHA256 of `payload` using AUTH_SECRET. Returns hex string. */
function hmacPayload(payload: string): string {
  const secret = env.AUTH_SECRET ?? "dev-secret-not-for-production";
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Generate a stateless magic-link token encoding the email and expiry.
 * Format: `<base64url(email)>.<expiresAtMs>.<hmac-hex>`
 * None of these segments contain dots, so splitting on `.` is safe.
 */
export function generateMagicToken(email: string): string {
  const expiresAt = Date.now() + TOKEN_EXPIRY_MS;
  const emailB64 = Buffer.from(email, "utf8").toString("base64url");
  const payload = `${emailB64}.${expiresAt}`;
  const sig = hmacPayload(payload);
  return `${payload}.${sig}`;
}

export type VerifyResult =
  | { valid: true; email: string }
  | { valid: false; reason: "expired" | "invalid" };

/** Verify a magic token and return the decoded email on success. */
export function verifyMagicToken(token: string): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, reason: "invalid" };

  const [emailB64, expiresAtStr, sig] = parts;
  const payload = `${emailB64}.${expiresAtStr}`;
  const expectedSig = hmacPayload(payload);

  let sigMatch = false;
  try {
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expectedSig, "hex");
    if (sigBuf.length !== expectedBuf.length) return { valid: false, reason: "invalid" };
    sigMatch = timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return { valid: false, reason: "invalid" };
  }

  if (!sigMatch) return { valid: false, reason: "invalid" };

  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return { valid: false, reason: "expired" };
  }

  let email: string;
  try {
    email = Buffer.from(emailB64, "base64url").toString("utf8");
    if (!email.includes("@")) return { valid: false, reason: "invalid" };
  } catch {
    return { valid: false, reason: "invalid" };
  }

  return { valid: true, email };
}

/**
 * Send a magic-link email via the Resend API.
 * Requires RESEND_API_KEY to be set.
 */
export async function sendMagicLinkEmail(
  email: string,
  token: string,
  baseUrl: string
): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

  const base = baseUrl.replace(/\/$/, "");
  const verifyUrl = `${base}/sign-in/verify?token=${encodeURIComponent(token)}`;
  const from = env.EMAIL_FROM ?? "SHR Admin <no-reply@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your SHR Admin sign-in link",
      text: [
        "Click the link below to sign in to SHR Admin.",
        "This link expires in 15 minutes.",
        "",
        verifyUrl,
        "",
        "If you did not request this, you can safely ignore this email.",
      ].join("\n"),
      html: [
        "<p>Click the link below to sign in to SHR Admin. This link expires in 15&nbsp;minutes.</p>",
        `<p><a href="${verifyUrl}">Sign in to SHR Admin</a></p>`,
        "<p style=\"color:#666;font-size:12px\">If you did not request this, you can safely ignore this email.</p>",
      ].join(""),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new Error(`Resend API error ${response.status}: ${body}`);
  }
}
