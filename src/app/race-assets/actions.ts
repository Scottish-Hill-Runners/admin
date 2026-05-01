"use server";

import { createContentPullRequestWithFiles } from "@/lib/github";
import { cleanGpx } from "@/lib/gpx-processing";
import { getEditorSession, buildPrAuthor } from "@/lib/auth-session";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_GPX_BYTES = 5 * 1024 * 1024; // 5 MB

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

  // --- validate epsilon ---
  const epsilonRaw = formData.get("epsilon");
  const epsilon = epsilonRaw !== null ? parseFloat(String(epsilonRaw)) : 10;
  if (!Number.isFinite(epsilon) || epsilon < 0 || epsilon > 100) {
    return { status: "error", message: "Smoothing tolerance must be 0–100 m." };
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
    if (imageFile.size > MAX_IMAGE_BYTES) {
      return { status: "error", message: "Map image must be under 10 MB." };
    }

    const ext = imageFile.name.toLowerCase().split(".").pop() ?? "";
    if (!ALLOWED_IMAGE_EXTS.has(ext)) {
      return {
        status: "error",
        message: "Map image must be a JPG, PNG, WebP, or SVG file.",
      };
    }

    const ab = await imageFile.arrayBuffer();
    const base64 = Buffer.from(ab).toString("base64");
    // Normalise .jpeg → .jpg
    const outputExt = ext === "jpeg" ? "jpg" : ext;

    files.push({
      path: `races/${raceId}/map.${outputExt}`,
      content: base64,
      encoding: "base64",
    });
  }

  // --- process GPX ---
  if (hasGpx && gpxFile instanceof File) {
    if (gpxFile.size > MAX_GPX_BYTES) {
      return { status: "error", message: "GPX file must be under 5 MB." };
    }

    const name = gpxFile.name.toLowerCase();
    if (!name.endsWith(".gpx")) {
      return {
        status: "error",
        message: "Route file must have a .gpx extension.",
      };
    }

    const rawText = await gpxFile.text();
    const { result, pointsBefore, pointsAfter } = cleanGpx(rawText, epsilon);
    gpxSummary =
      epsilon > 0
        ? `${pointsBefore.toLocaleString()} → ${pointsAfter.toLocaleString()} track points after ${epsilon} m smoothing`
        : `${pointsBefore.toLocaleString()} track points (no smoothing)`;

    files.push({
      path: `races/${raceId}/route.gpx`,
      content: result,
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
