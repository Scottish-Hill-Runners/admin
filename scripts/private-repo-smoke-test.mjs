import process from "node:process";
import {
  printContentHealthCheckReport,
  runContentHealthCheck,
} from "./content-health-check.mjs";

function printManualChecklist() {
  console.log("");
  console.log("Manual smoke checklist (run after health checks pass):");
  console.log("1. Sign in as an editor and open each main workflow page (news, races, results, calendar, collections, info, clubs, championships, long-distance, race assets).");
  console.log("2. Save one harmless draft update in at least two different content types and confirm each returns a draft URL.");
  console.log("3. Verify optional auto-merge labeling still works by checking that the label is present on the new draft.");
  console.log("4. Sign in as a publisher and confirm publish status loads, then open publication management.");
  console.log("5. Confirm one submission can be accepted and that staging-to-live publication request creation still succeeds.");
}

async function main() {
  console.log("Running private-repo smoke test (non-destructive checks)...");

  const healthReport = await runContentHealthCheck();
  printContentHealthCheckReport(healthReport);

  if (!healthReport.ok) {
    console.log("");
    console.log("Smoke test failed: resolve health check errors first.");
    process.exitCode = 1;
    return;
  }

  printManualChecklist();
  console.log("");
  console.log("Smoke test passed for non-destructive checks.");
}

main().catch((error) => {
  console.error("Smoke test could not complete:", error);
  process.exitCode = 1;
});
