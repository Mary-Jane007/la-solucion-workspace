/**
 * Fallback-videolink (optioneel) via .env — normaal beheert de eigenaar de video in Help.
 */
export const APP_UITLEG_VIDEO_URL =
  (import.meta.env.VITE_APP_UITLEG_VIDEO_URL as string | undefined)?.trim() || "";

export type HelpVideoSource = "link" | "file";

export type HelpVideoInfo = {
  source: HelpVideoSource;
  playbackUrl: string;
  originalName?: string | null;
};

export type HelpVideoKind = "youtube" | "vimeo" | "file";

export type HelpVideoEmbed = {
  kind: HelpVideoKind;
  src: string;
};

export function parseHelpVideoUrl(raw: string): HelpVideoEmbed | null {
  const url = raw.trim();
  if (!url) return null;

  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/i);
  if (ytMatch) {
    return { kind: "youtube", src: `https://www.youtube.com/embed/${ytMatch[1]}` };
  }

  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch) {
    return { kind: "vimeo", src: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }

  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url) || url.includes("/api/help/video/stream")) {
    return { kind: "file", src: url };
  }

  if (/youtube\.com\/embed\//i.test(url)) {
    return { kind: "youtube", src: url };
  }
  if (/player\.vimeo\.com\/video\//i.test(url)) {
    return { kind: "vimeo", src: url };
  }

  return null;
}

/** Zet API-video om naar afspeel-embed; env-fallback als er geen video in de app staat. */
export function helpVideoEmbed(
  video: HelpVideoInfo | null,
  streamUrlWithAuth: string
): HelpVideoEmbed | null {
  if (video?.source === "file") {
    return { kind: "file", src: streamUrlWithAuth };
  }
  if (video?.source === "link") {
    return parseHelpVideoUrl(video.playbackUrl);
  }
  if (APP_UITLEG_VIDEO_URL) {
    return parseHelpVideoUrl(APP_UITLEG_VIDEO_URL);
  }
  return null;
}

export const HELP_VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";
export const HELP_VIDEO_MAX_MB = 100;
