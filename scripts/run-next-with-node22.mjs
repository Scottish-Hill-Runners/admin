import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const command = process.argv[2];
const passthroughArgs = process.argv.slice(3);

if (!command || !["dev", "build", "start"].includes(command)) {
  console.error("Usage: node scripts/run-next-with-node22.mjs <dev|build|start> [...args]");
  process.exit(1);
}

const preferredNode22 = "/opt/homebrew/opt/node@22/bin/node";
const currentMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
const shouldUseCurrentNode = Number.isInteger(currentMajor) && currentMajor > 0 && currentMajor < 25;
const nodeBin = existsSync(preferredNode22)
  ? preferredNode22
  : shouldUseCurrentNode
    ? process.execPath
    : null;

if (!nodeBin) {
  console.error("Unsupported Node.js runtime detected: " + process.versions.node);
  console.error("This project requires Node 22 LTS for reliable Next.js memory usage.");
  console.error("Install Node 22 or use nvm/fnm/volta to activate it before running scripts.");
  process.exit(1);
}

const projectRoot = process.cwd();
const nextBin = join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const nodeArgs = [];

if (command === "dev") {
  nodeArgs.push("--max-old-space-size=4096");
}

if (command === "build") {
  nodeArgs.push("--max-old-space-size=6144");
}

nodeArgs.push(nextBin, command, ...passthroughArgs);

const child = spawn(nodeBin, nodeArgs, {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
