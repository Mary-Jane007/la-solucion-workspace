const { spawn } = require("child_process");
const { portInUse, killPort } = require("./port-utils");

const PORT = Number(process.env.PORT || 4000);
const watch = process.argv.includes("--watch");

function startServer() {
  return spawn("node", ["server/index.js"], {
    stdio: "inherit",
    shell: true,
    cwd: require("path").join(__dirname, "..")
  });
}

(async () => {
  if (await portInUse(PORT)) {
    await killPort(PORT);
    await new Promise((r) => setTimeout(r, 800));
  }

  if (!watch) {
    const child = startServer();
    child.on("exit", (code) => process.exit(code ?? 0));
    return;
  }

  console.log(`Backend op poort ${PORT} — herstart automatisch bij crash (Ctrl+C om te stoppen).`);
  let stopping = false;
  const run = () => {
    const child = startServer();
    child.on("exit", (code) => {
      if (stopping) process.exit(code ?? 0);
      if (code !== 0) {
        console.log("Backend crashte — herstart over 2 seconden…");
        setTimeout(run, 2000);
      } else {
        process.exit(0);
      }
    });
    process.on("SIGINT", () => {
      stopping = true;
      child.kill();
    });
  };
  run();
})();
