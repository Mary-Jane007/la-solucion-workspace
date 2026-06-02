require("dotenv").config();
const fs = require("fs");
const path = require("path");

async function main() {
  const health = await fetch("http://localhost:4000/api/health");
  console.log("health", health.status, await health.json());

  const loginPath = path.join(__dirname, "login-payload.json");
  fs.writeFileSync(
    loginPath,
    JSON.stringify({
      email: process.env.OWNER_EMAIL || "astridtaweroe@gmail.com",
      password: process.argv[2] || "test-wachtwoord"
    })
  );

  const login = await fetch("http://localhost:4000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: fs.readFileSync(loginPath)
  });
  const loginData = await login.json();
  console.log("login", login.status, loginData.error || loginData.user?.rol);

  if (!login.ok) return;

  const opdr = await fetch("http://localhost:4000/api/opdrachten", {
    headers: { Authorization: `Bearer ${loginData.token}` }
  });
  const opdrData = await opdr.json();
  console.log("opdrachten", opdr.status, "count:", opdrData.opdrachten?.length ?? opdrData.error);
}

main().catch(console.error);
