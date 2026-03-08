import { spawn, spawnSync } from "node:child_process";

const children = [];

function start(command, args, name) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      shutdown(code);
    }
  });

  children.push(child);
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(code), 50);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const initialBuild = spawnSync("npx", ["tsc", "-p", "ws-service/tsconfig.json"], {
  cwd: process.cwd(),
  stdio: "inherit",
});

if (initialBuild.status && initialBuild.status !== 0) {
  process.exit(initialBuild.status);
}

start(
  "npx",
  ["tsc", "--watch", "--preserveWatchOutput", "-p", "ws-service/tsconfig.json"],
  "ws-service tsc watcher",
);
start(
  "node",
  ["--watch", "--watch-preserve-output", "ws-service/dist/ws-service/src/index.js"],
  "ws-service node watcher",
);
