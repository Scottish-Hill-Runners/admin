import { createHash } from "node:crypto";
import sharp from "sharp";

type ImageOptimizationPreset = {
  maxWidth: number;
  maxHeight: number;
  quality: number;
};

const PRESETS: Record<"racePhoto" | "mapImage", ImageOptimizationPreset> = {
  racePhoto: {
    maxWidth: 2400,
    maxHeight: 1600,
    quality: 82,
  },
  mapImage: {
    maxWidth: 2400,
    maxHeight: 1800,
    quality: 82,
  },
};

const ALLOWED_INPUT_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "svg"]);

type OptimizeUploadedImageInput = {
  file: File;
  maxBytes: number;
  preset: keyof typeof PRESETS;
  allowSvg?: boolean;
};

export type OptimizedUploadImage = {
  buffer: Buffer;
  outputExtension: "jpg" | "webp" | "svg";
};

function getExtension(fileName: string): string {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

function toFriendlyAllowedExtensions(allowSvg: boolean): string {
  return allowSvg ? "JPG, PNG, WebP, GIF, or SVG" : "JPG, PNG, WebP, or GIF";
}

export async function optimizeUploadedImage({
  file,
  maxBytes,
  preset,
  allowSvg = false,
}: OptimizeUploadedImageInput): Promise<OptimizedUploadImage> {
  if (file.size > maxBytes) {
    throw new Error(`Image must be under ${Math.floor(maxBytes / (1024 * 1024))} MB.`);
  }

  const extension = getExtension(file.name);
  if (!ALLOWED_INPUT_EXTENSIONS.has(extension)) {
    throw new Error(`Image must be a ${toFriendlyAllowedExtensions(allowSvg)} file.`);
  }

  if (extension === "svg") {
    if (!allowSvg) {
      throw new Error("SVG files are not supported in this upload.");
    }

    const svgBuffer = Buffer.from(await file.arrayBuffer());
    return {
      buffer: svgBuffer,
      outputExtension: "svg",
    };
  }

  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const selectedPreset = PRESETS[preset];
    const outputFormat: "webp" | "jpeg" = extension === "webp" ? "webp" : "jpeg";

    const basePipeline = sharp(inputBuffer, {
      failOn: "none",
      limitInputPixels: 60_000_000,
      animated: false,
    })
      .rotate()
      .resize({
        width: selectedPreset.maxWidth,
        height: selectedPreset.maxHeight,
        fit: "inside",
        withoutEnlargement: true,
      });

    const outputBuffer =
      outputFormat === "webp"
        ? await basePipeline
            .webp({
              quality: selectedPreset.quality,
            })
            .toBuffer()
        : await basePipeline
            .jpeg({
              quality: selectedPreset.quality,
              mozjpeg: true,
              progressive: true,
            })
            .toBuffer();

    return {
      buffer: outputBuffer,
      outputExtension: outputFormat === "webp" ? "webp" : "jpg",
    };
  } catch {
    throw new Error("This image could not be processed. Please choose a different file.");
  }
}

export function computeHashFilename(buffer: Buffer, ext: string): string {
  const hash = createHash("sha256").update(buffer).digest("hex");
  return `${hash.slice(0, 12)}.${ext}`;
}
