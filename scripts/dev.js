const { spawn } = require("child_process");
const path = require("path");
const { portInUse, killPort } = require("./port-utils");

const ROOT = path.join(__dirname, "..");
const API_PORT = Number(process.env.PORT || 4000);
const children = [];
let shuttingDown = false;
let serverRestartTimer = null;

function spawnProcess(name, command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: true,
    cwd: ROOT,
    env: process.env
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.log(`[${name}] gestopt (code=${code ?? "?"}, signal=${signal ?? "?"})`);
  });
  return child;
}

function startBackend() {
  if (shuttingDown) return;
  const child = spawnProcess("backend", "node", ["server/index.js"]);
  child.on("exit", (code) => {
    if (shuttingDown || code === 0) return;
    console.log("[backend] crashte — herstart over 2 seconden…");
    serverRestartTimer = setTimeout(startBackend, 2000);
  });
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearTimeout(serverRestartTimer);
  for (const child of children) {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

(async () => {
  if (await portInUse(API_PORT)) {
    console.log(`Poort ${API_PORT} is bezet — oude backend wordt gestopt…`);
    await killPort(API_PORT);
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log("Start backend (API) + frontend (Vite)…");
  console.log(`  API:      http://127.0.0.1:${API_PORT}/api/health`);
  console.log("  Frontend: http://127.0.0.1:5173/");
  console.log("Stop alles met Ctrl+C.\n");

  startBackend();
  const vite = spawnProcess("frontend", "npx", ["vite"]);
  vite.on("exit", (code) => shutdown(code ?? 0));
})();
