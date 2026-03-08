import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

function start(command, args, name, options = {}) {
  const { required = false, restart = false, restartDelayMs = 1200 } = options;
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
    detached: true,
  });

  child.on("exit", (code, signal) => {
    if (signal || shuttingDown) return;

    if (restart) {
      console.error(`${name} exited with code ${code ?? "unknown"}. Restarting...`);
      setTimeout(() => {
        if (!shuttingDown) {
          start(command, args, name, options);
        }
      }, restartDelayMs);
      return;
    }

    if (code && code !== 0 && required) {
      console.error(`${name} exited with code ${code}`);
      shutdown(code);
      return;
    }

    if (code && code !== 0 && !required) {
      console.error(`${name} exited with code ${code}. Frontend will keep running.`);
    }

    if ((!code || code === 0) && required) {
      shutdown(0);
    }
  });

  children.push(child);
}

function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    }
  }

  setTimeout(() => process.exit(code), 50);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("npm", ["run", "ws:dev"], "WebSocket service", { required: false });
start("npm", ["run", "dev:web"], "Next.js frontend", { required: true, restart: true });
