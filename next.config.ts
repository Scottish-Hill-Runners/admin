import type { NextConfig } from "next";

function toHost(value: string | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).host;
  } catch {
    return null;
  }
}

const serverActionAllowedOrigins = Array.from(
  new Set(
    [
      toHost(process.env.NEXTAUTH_URL),
      "localhost:3000",
      "localhost:3001",
      "127.0.0.1:3000",
      "127.0.0.1:3001",
      "admin.scottishhillrunners.uk",
    ].filter((value): value is string => Boolean(value))
  )
);

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      // Allow up to 12 MB to accommodate map image + GPX uploads
      bodySizeLimit: "12mb",
      allowedOrigins: serverActionAllowedOrigins,
    },
  },
};

export default nextConfig;
