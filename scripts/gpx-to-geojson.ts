#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { gpxToRouteGeoJson } from "../src/lib/gpx-processing";

type CliArgs = {
  inputPath: string;
  outputPath: string;
  epsilonM: number;
};

function printUsage(): void {
  console.log(
    [
      "Usage:",
      "  npx tsx scripts/gpx-to-geojson.ts <input.gpx> [output.geojson] [--epsilon=<metres>]",
      "",
      "Examples:",
      "  npx tsx scripts/gpx-to-geojson.ts benarty.gpx",
      "  npx tsx scripts/gpx-to-geojson.ts route.gpx route.geojson --epsilon=25",
    ].join("\n"),
  );
}

function parseArgs(argv: string[]): CliArgs {
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  const epsilonArg = argv.find((arg) => arg.startsWith("--epsilon="));

  if (positional.length < 1) {
    printUsage();
    throw new Error("Missing input GPX path.");
  }

  const inputPath = path.resolve(positional[0]);
  const outputPath = positional[1]
    ? path.resolve(positional[1])
    : path.join(
        path.dirname(inputPath),
        `${path.basename(inputPath, path.extname(inputPath))}.geojson`,
      );

  const epsilonM = epsilonArg ? Number(epsilonArg.split("=")[1]) : 50;
  if (!Number.isFinite(epsilonM) || epsilonM < 0) {
    throw new Error("--epsilon must be a non-negative number.");
  }

  return { inputPath, outputPath, epsilonM };
}

async function main(): Promise<void> {
  const { inputPath, outputPath, epsilonM } = parseArgs(process.argv.slice(2));

  const gpxText = await fs.readFile(inputPath, "utf8");
  const { geojson, pointsBefore, pointsAfter } = gpxToRouteGeoJson(gpxText, epsilonM, []);

  if (pointsBefore === 0) {
    throw new Error("No route points found in the GPX file.");
  }

  await fs.writeFile(outputPath, `${geojson}\n`, "utf8");

  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Points: ${pointsBefore} -> ${pointsAfter} (epsilon ${epsilonM} m)`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`gpx-to-geojson failed: ${message}`);
  process.exit(1);
});
