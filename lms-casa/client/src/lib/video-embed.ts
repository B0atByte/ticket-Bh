export type EmbedProvider = 'youtube' | 'vimeo';

export interface VideoEmbed {
  provider: EmbedProvider;
  embedUrl: string;
  videoId: string;
}

const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function youtubeId(u: URL): string | null {
  if (u.hostname === 'youtu.be') {
    const id = u.pathname.replace(/^\/+/, '').split('/')[0];
    return id || null;
  }
  if (u.pathname === '/watch') return u.searchParams.get('v');
  const m = u.pathname.match(/^\/(?:embed|shorts|v|live)\/([^/?]+)/);
  return m?.[1] ?? null;
}

function vimeoId(u: URL): string | null {
  if (u.hostname === 'player.vimeo.com') {
    const m = u.pathname.match(/^\/video\/(\d+)/);
    return m?.[1] ?? null;
  }
  const m = u.pathname.match(/^\/(\d+)/);
  return m?.[1] ?? null;
}

export function getVideoEmbed(rawUrl: string | null | undefined): VideoEmbed | null {
  if (!rawUrl) return null;
  const u = parseUrl(rawUrl.trim());
  if (!u) return null;
  const host = u.hostname.toLowerCase();

  if (YT_HOSTS.has(host)) {
    const id = youtubeId(u);
    if (!id || !/^[a-zA-Z0-9_-]{6,}$/.test(id)) return null;
    const start = u.searchParams.get('t') ?? u.searchParams.get('start');
    const startSec = start ? parseStartParam(start) : 0;
    const params = new URLSearchParams({ rel: '0', modestbranding: '1' });
    if (startSec > 0) params.set('start', String(startSec));
    return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}?${params}`, videoId: id };
  }

  if (VIMEO_HOSTS.has(host)) {
    const id = vimeoId(u);
    if (!id) return null;
    return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}`, videoId: id };
  }

  return null;
}

function parseStartParam(raw: string): number {
  if (/^\d+$/.test(raw)) return Number(raw);
  const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!m) return 0;
  const [, h, mm, s] = m;
  return Number(h ?? 0) * 3600 + Number(mm ?? 0) * 60 + Number(s ?? 0);
}

/** Convert a Google Drive PDF share link to its inline preview URL (others pass through). */
export function getPdfEmbedUrl(url: string): string {
  const m = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  return url;
}

/** Convert a Google Slides link to its embed URL (others pass through). */
export function getSlidesEmbedUrl(url: string): string {
  const m = url.match(/docs\.google\.com\/presentation\/d\/([^/?#]+)/);
  if (m) return `https://docs.google.com/presentation/d/${m[1]}/embed?start=false&loop=false`;
  return url;
}
