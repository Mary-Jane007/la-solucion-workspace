const fs = require("fs");
const path = require("path");
const { query } = require("./db");

const DATA_PATH = path.join(__dirname, "data.json");
const SETTINGS_KEY = "help_video_url";

function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

function readLocalData() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeLocalData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

function normalizeHelpVideoUrl(raw) {
  const url = String(raw || "").trim();
  if (!url) return "";
  if (url.length > 2048) {
    throw new Error("De videolink is te lang (max. 2048 tekens).");
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Alleen links die beginnen met http:// of https:// zijn toegestaan.");
  }
  const allowed =
    /youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com|\.mp4(\?|$)|\.webm(\?|$)|\.ogg(\?|$)/i.test(
      url
    );
  if (!allowed) {
    throw new Error("Alleen YouTube-, Vimeo- of directe videolinks (.mp4, .webm, .ogg) zijn toegestaan.");
  }
  return url;
}

async function getHelpVideoUrl() {
  if (!hasDb()) {
    const data = readLocalData();
    return String(data.settings?.helpVideoUrl || "").trim();
  }
  const res = await query("select value from app_settings where key=$1 limit 1", [SETTINGS_KEY]);
  return String(res.rows[0]?.value || "").trim();
}

async function setHelpVideoUrl(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) {
    throw new Error("Vul een videolink in.");
  }
  const url = normalizeHelpVideoUrl(trimmed);
  if (!hasDb()) {
    const data = readLocalData();
    data.settings = { ...(data.settings || {}), helpVideoUrl: url };
    writeLocalData(data);
    return url;
  }
  await query(
    `
    insert into app_settings (key, value, updated_at)
    values ($1, $2, now())
    on conflict (key) do update
    set value = excluded.value, updated_at = now()
    `,
    [SETTINGS_KEY, url]
  );
  return url;
}

async function clearHelpVideoUrl() {
  if (!hasDb()) {
    const data = readLocalData();
    data.settings = { ...(data.settings || {}), helpVideoUrl: "" };
    writeLocalData(data);
    return "";
  }
  await query(
    `
    insert into app_settings (key, value, updated_at)
    values ($1, '', now())
    on conflict (key) do update
    set value = '', updated_at = now()
    `,
    [SETTINGS_KEY]
  );
  return "";
}

module.exports = {
  normalizeHelpVideoUrl,
  getHelpVideoUrl,
  setHelpVideoUrl,
  clearHelpVideoUrl
};
