import { env } from "@/lib/env";

const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

const subtle = globalThis.crypto.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Generate a stateless magic-link token encoding the email and expiry.
 * Format: `<base64url(email)>.<expiresAtMs>.<hmac-hex>`
 * None of these segments contain dots, so splitting on `.` is safe.
 */
export async function generateMagicToken(email: string): Promise<string> {
  const secret = env.AUTH_SECRET ?? "dev-secret-not-for-production";
  const key = await importHmacKey(secret);
  const expiresAt = Date.now() + TOKEN_EXPIRY_MS;
  const emailB64 = toBase64Url(encoder.encode(email));
  const payload = `${emailB64}.${expiresAt}`;
  const sig = toHex(new Uint8Array(await subtle.sign("HMAC", key, encoder.encode(payload))));
  return `${payload}.${sig}`;
}

export type VerifyResult =
  | { valid: true; email: string }
  | { valid: false; reason: "expired" | "invalid" };

/** Verify a magic token and return the decoded email on success. */
export async function verifyMagicToken(token: string): Promise<VerifyResult> {
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, reason: "invalid" };

  const [emailB64, expiresAtStr, sig] = parts;
  const payload = `${emailB64}.${expiresAtStr}`;

  const secret = env.AUTH_SECRET ?? "dev-secret-not-for-production";
  const key = await importHmacKey(secret);

  let sigValid = false;
  try {
    sigValid = await subtle.verify("HMAC", key, fromHex(sig), encoder.encode(payload));
  } catch {
    return { valid: false, reason: "invalid" };
  }

  if (!sigValid) return { valid: false, reason: "invalid" };

  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return { valid: false, reason: "expired" };
  }

  let email: string;
  try {
    email = decoder.decode(fromBase64Url(emailB64));
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
