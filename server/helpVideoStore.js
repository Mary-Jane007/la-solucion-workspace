const fs = require("fs");
const path = require("path");
const { query } = require("./db");

const DATA_PATH = path.join(__dirname, "data.json");
const SETTINGS_KEY = "help_video_url";
const HELP_VIDEO_DIR = path.join(__dirname, "uploads", "help-video");
const HELP_VIDEO_BASENAME = "help-uitleg";
const HELP_VIDEO_ROW_ID = 1;

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

function extFromMime(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("webm")) return ".webm";
  if (mime.includes("quicktime")) return ".mov";
  if (mime.includes("ogg")) return ".ogg";
  if (mime.includes("msvideo") || mime.includes("avi")) return ".avi";
  return ".mp4";
}

function parseStoredVideo(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed?.kind === "link" && parsed.url) {
      return {
        kind: "link",
        url: String(parsed.url).trim(),
        originalName: null,
        mimeType: null,
        storage: null,
        storageName: null
      };
    }
    if (parsed?.kind === "file") {
      return {
        kind: "file",
        url: null,
        originalName: String(parsed.originalName || "Uitlegvideo").trim() || "Uitlegvideo",
        mimeType: String(parsed.mimeType || "video/mp4").trim() || "video/mp4",
        storage: parsed.storage === "database" ? "database" : "disk",
        storageName: parsed.storageName ? String(parsed.storageName).trim() : null
      };
    }
  } catch {
    /* legacy plain url */
  }
  if (/^https?:\/\//i.test(text)) {
    return { kind: "link", url: text, originalName: null, mimeType: null, storage: null, storageName: null };
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
    storage: video.storage || "disk",
    storageName: video.storageName || null,
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

async function deleteHelpVideoBlob() {
  if (!hasDb()) return;
  await query("delete from help_video_files where id=$1", [HELP_VIDEO_ROW_ID]);
}

function deleteHelpVideoFiles() {
  try {
    ensureHelpVideoDir();
    for (const name of fs.readdirSync(HELP_VIDEO_DIR)) {
      if (!name.startsWith(HELP_VIDEO_BASENAME)) continue;
      try {
        fs.unlinkSync(path.join(HELP_VIDEO_DIR, name));
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* map bestaat niet */
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

async function readHelpVideoBufferFromDb() {
  if (!hasDb()) return null;
  const res = await query(
    "select original_name, mime_type, data from help_video_files where id=$1 limit 1",
    [HELP_VIDEO_ROW_ID]
  );
  const row = res.rows[0];
  if (!row?.data) return null;
  return {
    buffer: Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data),
    mimeType: row.mime_type || "video/mp4",
    originalName: row.original_name || "Uitlegvideo"
  };
}

async function getHelpVideoForStream() {
  const video = await getHelpVideo();
  if (!video || video.kind !== "file") return null;

  if (video.storage === "database" || hasDb()) {
    const fromDb = await readHelpVideoBufferFromDb();
    if (fromDb) return { ...fromDb, filePath: null };
  }

  if (video.storageName) {
    ensureHelpVideoDir();
    const filePath = path.join(HELP_VIDEO_DIR, video.storageName);
    if (fs.existsSync(filePath)) {
      return {
        buffer: null,
        filePath,
        mimeType: video.mimeType || "video/mp4",
        originalName: video.originalName || "Uitlegvideo"
      };
    }
  }

  return null;
}

async function setHelpVideoLink(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) {
    throw new Error("Vul een videolink in.");
  }
  const url = normalizeHelpVideoUrl(trimmed);
  await deleteHelpVideoBlob();
  deleteHelpVideoFiles();
  await writeRawSetting(
    serializeVideo({ kind: "link", url, originalName: null, mimeType: null, storage: null, storageName: null })
  );
  return toPublicHelpVideo(await getHelpVideo());
}

async function saveHelpVideoBuffer({ buffer, originalName, mimeType }) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Geen videobestand ontvangen.");
  }

  const safeName = String(originalName || "Uitlegvideo").trim() || "Uitlegvideo";
  const safeMime = String(mimeType || "video/mp4").trim() || "video/mp4";

  deleteHelpVideoFiles();

  if (hasDb()) {
    await query(
      `
      insert into help_video_files (id, original_name, mime_type, data, updated_at)
      values ($1, $2, $3, $4, now())
      on conflict (id) do update
      set original_name = excluded.original_name,
          mime_type = excluded.mime_type,
          data = excluded.data,
          updated_at = now()
      `,
      [HELP_VIDEO_ROW_ID, safeName, safeMime, buffer]
    );
    await writeRawSetting(
      serializeVideo({
        kind: "file",
        storage: "database",
        storageName: null,
        originalName: safeName,
        mimeType: safeMime
      })
    );
  } else {
    ensureHelpVideoDir();
    const storageName = `${HELP_VIDEO_BASENAME}${extFromMime(safeMime)}`;
    fs.writeFileSync(path.join(HELP_VIDEO_DIR, storageName), buffer);
    await writeRawSetting(
      serializeVideo({
        kind: "file",
        storage: "disk",
        storageName,
        originalName: safeName,
        mimeType: safeMime
      })
    );
  }

  return toPublicHelpVideo(await getHelpVideo());
}

async function clearHelpVideo() {
  await deleteHelpVideoBlob();
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
  getHelpVideoForStream,
  setHelpVideoLink,
  saveHelpVideoBuffer,
  clearHelpVideo,
  toPublicHelpVideo
};
