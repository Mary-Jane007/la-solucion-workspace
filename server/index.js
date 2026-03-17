const { startServer } = require("./app");

startServer().catch((err) => {
  console.error("Backend start mislukt:", err);
  process.exit(1);
});

