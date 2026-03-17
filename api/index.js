const { createApp } = require("../server/app");

// Vercel Serverless Function entrypoint.
// Express apps are compatible because they are (req, res) handlers.
const app = createApp();

module.exports = (req, res) => app(req, res);

