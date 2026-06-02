const { execSync, spawn } = require("child_process");
const net = require("net");

const PORT = Number(process.env.PORT || 4000);

function portInUse(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(true));
    s.once("listening", () => {
      s.close(() => resolve(false));
    });
    s.listen(port);
  });
}

async function killPort(port) {
  if (process.platform !== "win32") return;
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
    const pids = new Set();
    for (const line of out.split("\n")) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== "0") pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        console.log(`Proces ${pid} op poort ${port} gestopt.`);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* geen proces */
  }
}

(async () => {
  if (await portInUse(PORT)) {
    await killPort(PORT);
    await new Promise((r) => setTimeout(r, 800));
  }
  const child = spawn("node", ["server/index.js"], {
    stdio: "inherit",
    shell: true,
    cwd: require("path").join(__dirname, "..")
  });
  child.on("exit", (code) => process.exit(code ?? 0));
})();
