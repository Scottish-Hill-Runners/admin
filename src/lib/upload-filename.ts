export type UploadMode = "image" | "any";

const allowedImageExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function toCanonicalImageExtension(extension: string): string {
  if (extension === "webp") {
    return "webp";
  }

  return "jpg";
}

export function toSafeUploadFilename(originalName: string, mode: UploadMode): string | null {
  const trimmed = String(originalName).trim();
  const extensionSeparator = trimmed.lastIndexOf(".");
  if (extensionSeparator <= 0 || extensionSeparator === trimmed.length - 1) {
    return null;
  }

  const rawBase = trimmed.slice(0, extensionSeparator);
  const rawExtension = trimmed.slice(extensionSeparator + 1).toLowerCase();
  const safeExtension = rawExtension.replace(/[^a-z0-9]+/g, "");

  if (!safeExtension) {
    return null;
  }

  if (mode === "image" && !allowedImageExtensions.has(safeExtension)) {
    return null;
  }

  const normalizedExtension =
    mode === "image" ? toCanonicalImageExtension(safeExtension) : safeExtension;

  const safeBase = rawBase
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .replace(/[-.]+$/, "");

  if (!safeBase || safeBase === "." || safeBase === "..") {
    return null;
  }

  return `${safeBase}.${normalizedExtension}`;
}
