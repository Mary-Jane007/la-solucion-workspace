const fs = require("fs");
const path = require("path");
const { query } = require("./db");

const DATA_PATH = path.join(__dirname, "data.json");
const SETTINGS_KEY = "help_video_url";
const HELP_VIDEO_DIR = path.join(__dirname, "uploads", "help-video");
const HELP_VIDEO_BASENAME = "help-uitleg";

function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

function ensureHelpVideoDir() {
  if (!fs.existsSync(HELP_VIDEO_DIR)) {
    fs.mkdirSync(HELP_VIDEO_DIR, { recursive: true });
  }
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

function parseStoredVideo(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed?.kind === "link" && parsed.url) {
      return { kind: "link", url: String(parsed.url).trim(), originalName: null, mimeType: null, storageName: null };
    }
    if (parsed?.kind === "file" && parsed.storageName) {
      return {
        kind: "file",
        url: null,
        originalName: String(parsed.originalName || "Uitlegvideo").trim() || "Uitlegvideo",
        mimeType: String(parsed.mimeType || "video/mp4").trim() || "video/mp4",
        storageName: String(parsed.storageName).trim()
      };
    }
  } catch {
    /* legacy plain url */
  }
  if (/^https?:\/\//i.test(text)) {
    return { kind: "link", url: text, originalName: null, mimeType: null, storageName: null };
  }
  return null;
}

function serializeVideo(video) {
  if (!video) return "";
  if (video.kind === "link") {
    return JSON.stringify({ kind: "link", url: video.url });
  }
  return JSON.stringify({
    kind: "file",
    storageName: video.storageName,
    originalName: video.originalName,
    mimeType: video.mimeType
  });
}

async function readRawSetting() {
  if (!hasDb()) {
    return String(readLocalData().settings?.helpVideoUrl || "").trim();
  }
  const res = await query("select value from app_settings where key=$1 limit 1", [SETTINGS_KEY]);
  return String(res.rows[0]?.value || "").trim();
}

async function writeRawSetting(value) {
  if (!hasDb()) {
    const data = readLocalData();
    data.settings = { ...(data.settings || {}), helpVideoUrl: value };
    writeLocalData(data);
    return;
  }
  await query(
    `
    insert into app_settings (key, value, updated_at)
    values ($1, $2, now())
    on conflict (key) do update
    set value = excluded.value, updated_at = now()
    `,
    [SETTINGS_KEY, value]
  );
}

function deleteHelpVideoFiles() {
  ensureHelpVideoDir();
  for (const name of fs.readdirSync(HELP_VIDEO_DIR)) {
    if (!name.startsWith(HELP_VIDEO_BASENAME)) continue;
    try {
      fs.unlinkSync(path.join(HELP_VIDEO_DIR, name));
    } catch {
      /* ignore */
    }
  }
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

function toPublicHelpVideo(video) {
  if (!video) return null;
  if (video.kind === "link") {
    return {
      source: "link",
      playbackUrl: video.url,
      originalName: null
    };
  }
  return {
    source: "file",
    playbackUrl: "/api/help/video/stream",
    originalName: video.originalName
  };
}

async function getHelpVideo() {
  return parseStoredVideo(await readRawSetting());
}

async function getHelpVideoFilePath() {
  const video = await getHelpVideo();
  if (!video || video.kind !== "file" || !video.storageName) return null;
  ensureHelpVideoDir();
  const filePath = path.join(HELP_VIDEO_DIR, video.storageName);
  if (!fs.existsSync(filePath)) return null;
  return { filePath, mimeType: video.mimeType || "video/mp4", originalName: video.originalName };
}

async function setHelpVideoLink(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) {
    throw new Error("Vul een videolink in.");
  }
  const url = normalizeHelpVideoUrl(trimmed);
  deleteHelpVideoFiles();
  await writeRawSetting(serializeVideo({ kind: "link", url, originalName: null, mimeType: null, storageName: null }));
  return toPublicHelpVideo(await getHelpVideo());
}

async function setHelpVideoFile({ storageName, originalName, mimeType }) {
  if (!storageName) {
    throw new Error("Geen videobestand ontvangen.");
  }
  // Verwijder oude bestanden (andere extensie) vóór metadata-update.
  for (const name of fs.readdirSync(HELP_VIDEO_DIR)) {
    if (name.startsWith(HELP_VIDEO_BASENAME) && name !== storageName) {
      try {
        fs.unlinkSync(path.join(HELP_VIDEO_DIR, name));
      } catch {
        /* ignore */
      }
    }
  }
  await writeRawSetting(
    serializeVideo({
      kind: "file",
      url: null,
      storageName,
      originalName: originalName || "Uitlegvideo",
      mimeType: mimeType || "video/mp4"
    })
  );
  return toPublicHelpVideo(await getHelpVideo());
}

async function clearHelpVideo() {
  deleteHelpVideoFiles();
  await writeRawSetting("");
  return null;
}

module.exports = {
  HELP_VIDEO_DIR,
  HELP_VIDEO_BASENAME,
  ensureHelpVideoDir,
  normalizeHelpVideoUrl,
  getHelpVideo,
  getHelpVideoFilePath,
  setHelpVideoLink,
  setHelpVideoFile,
  clearHelpVideo,
  toPublicHelpVideo
};
