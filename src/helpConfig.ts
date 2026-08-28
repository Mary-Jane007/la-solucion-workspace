/**
 * Fallback-videolink (optioneel) via .env — normaal beheert de eigenaar de video in Help.
 * VITE_APP_UITLEG_VIDEO_URL=https://www.youtube.com/watch?v=...
 */
export const APP_UITLEG_VIDEO_URL =
  (import.meta.env.VITE_APP_UITLEG_VIDEO_URL as string | undefined)?.trim() || "";

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

  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
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

/** API-url heeft voorrang; anders optionele env-fallback. */
export function resolveHelpVideoUrl(apiUrl: string): string {
  return apiUrl.trim() || APP_UITLEG_VIDEO_URL;
}
