"use server";

import { createContentPullRequestWithFiles } from "@/lib/github";
import { gpxToRouteGeoJson, type CheckpointInput } from "@/lib/gpx-processing";
import { getEditorSession, buildPrAuthor } from "@/lib/auth-session";
import { optimizeUploadedImage } from "@/lib/image-upload";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_GPX_BYTES = 20 * 1024 * 1024; // 20 MB
const GPX_EPSILON_M = 50; // fixed smoothing tolerance

const ALLOWED_IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "svg"]);
const RACE_ID_RE = /^[A-Za-z0-9-]{2,80}$/;

export type RaceAssetsActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  prUrl?: string;
  prNumber?: number;
  gpxSummary?: string;
};

export async function uploadRaceAssets(
  _prev: RaceAssetsActionState,
  formData: FormData,
): Promise<RaceAssetsActionState> {
  // --- validate raceId ---
  const raceId = String(formData.get("raceId") ?? "").trim();
  if (!RACE_ID_RE.test(raceId)) {
    return {
      status: "error",
      message:
        "Invalid race ID. Use 2–80 characters: letters, numbers, and hyphens only.",
    };
  }

  const imageFile = formData.get("imageFile");
  const gpxFile = formData.get("gpxFile");

  const hasImage = imageFile instanceof File && imageFile.size > 0;
  const hasGpx = gpxFile instanceof File && gpxFile.size > 0;

  if (!hasImage && !hasGpx) {
    return {
      status: "error",
      message: "Please select at least one file to upload (map image or GPX).",
    };
  }

  type FileEntry = {
    path: string;
    content: string;
    encoding: "utf8" | "base64";
  };

  const files: FileEntry[] = [];
  let gpxSummary: string | undefined;

  // --- process image ---
  if (hasImage && imageFile instanceof File) {
    const ext = imageFile.name.toLowerCase().split(".").pop() ?? "";
    if (!ALLOWED_IMAGE_EXTS.has(ext)) {
      return {
        status: "error",
        message: "Map image must be a JPG, PNG, WebP, or SVG file.",
      };
    }

    let optimizedImage;
    try {
      optimizedImage = await optimizeUploadedImage({
        file: imageFile,
        maxBytes: MAX_IMAGE_BYTES,
        preset: "mapImage",
        allowSvg: true,
      });
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Map image could not be processed.",
      };
    }

    files.push({
      path: `races/${raceId}/map.${optimizedImage.outputExtension}`,
      content: optimizedImage.buffer.toString("base64"),
      encoding: "base64",
    });
  }

  // --- process GPX ---
  if (hasGpx && gpxFile instanceof File) {
    if (gpxFile.size > MAX_GPX_BYTES) {
      return { status: "error", message: "GPX file must be under 20 MB." };
    }

    const name = gpxFile.name.toLowerCase();
    if (!name.endsWith(".gpx")) {
      return {
        status: "error",
        message: "Route file must have a .gpx extension.",
      };
    }

    const rawText = await gpxFile.text();

    // Parse checkpoint data from the GeoJSON submitted alongside the GPX.
    const checkpointsRaw = String(formData.get("checkpointsGeoJson") ?? "").trim();
    let checkpoints: CheckpointInput[] = [];

    if (checkpointsRaw.length > 0) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(checkpointsRaw);
      } catch {
        return {
          status: "error",
          message: "Checkpoint data could not be read. Please try again.",
        };
      }

      // Validate: must be a GeoJSON FeatureCollection of Point features
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        (parsed as Record<string, unknown>)["type"] !== "FeatureCollection" ||
        !Array.isArray((parsed as Record<string, unknown>)["features"])
      ) {
        return {
          status: "error",
          message: "Checkpoint data is in an unexpected format. Please try again.",
        };
      }

      const features = (parsed as { features: unknown[] })["features"];
      for (const f of features) {
        if (
          typeof f !== "object" ||
          f === null ||
          (f as Record<string, unknown>)["type"] !== "Feature" ||
          (f as { geometry?: { type?: unknown } }).geometry?.type !== "Point"
        ) {
          return {
            status: "error",
            message: "Checkpoint data contains unexpected geometry. Please try again.",
          };
        }
        const props = (f as { properties?: Record<string, unknown> }).properties ?? {};
        const idx = props["trackPointIndex"];
        if (typeof idx === "number" && Number.isInteger(idx) && idx >= 0) {
          checkpoints.push({
            trackPointIndex: idx,
            name: typeof props["name"] === "string" ? props["name"] : "",
            cutoff: typeof props["cutoff"] === "string" ? props["cutoff"] : "",
            notes: typeof props["notes"] === "string" ? props["notes"] : "",
          });
        }
      }
    }

    const { geojson, pointsBefore, pointsAfter } = gpxToRouteGeoJson(
      rawText,
      GPX_EPSILON_M,
      checkpoints,
    );

    gpxSummary = `${pointsBefore.toLocaleString()} → ${pointsAfter.toLocaleString()} track points after ${GPX_EPSILON_M} m smoothing`;

    files.push({
      path: `races/${raceId}/route.geojson`,
      content: geojson,
      encoding: "utf8",
    });
  }

  // --- upload ---
  const editorSession = await getEditorSession();
  const author = buildPrAuthor(editorSession);
  const autoMerge = formData.get("autoMerge") === "on";

  // Include a timestamp in the branch name to avoid collisions on re-upload
  const branchName = `shr-admin/race-assets-${raceId}-${Date.now()}`;

  const fileList = files.map((f) => `- \`${f.path}\``).join("\n");
  const prBodyLines = [
    `Race asset upload for **${raceId}**.`,
    "",
    fileList,
    ...(gpxSummary ? ["", `GPX: ${gpxSummary}.`] : []),
  ];

  try {
    const prResult = await createContentPullRequestWithFiles({
      title: `Race assets: ${raceId}`,
      files,
      commitMessage: `Add race assets: ${raceId}`,
      prTitle: `Race assets: ${raceId}`,
      prBody: prBodyLines.join("\n"),
      branchName,
      author,
      labels: autoMerge ? ["auto-merge"] : undefined,
    });

    return {
      status: "success",
      message: `PR #${prResult.prNumber} created successfully.`,
      prUrl: prResult.prUrl,
      prNumber: prResult.prNumber,
      gpxSummary,
    };
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error ? err.message : "Upload failed — please try again.",
    };
  }
}
