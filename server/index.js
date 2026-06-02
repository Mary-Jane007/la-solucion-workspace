const { startServer } = require("./app");

startServer().catch((err) => {
  console.error("Backend start mislukt:", err.message || err);
  process.exit(1);
});
