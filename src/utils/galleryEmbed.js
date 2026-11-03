export const GALLERY_TYPES = {
  image: 'Image',
  video: 'Video file',
  audio: 'Audio file',
  youtube: 'YouTube',
  youtube_short: 'YouTube Short',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook',
};

export const GALLERY_FILE_TYPES = ['image', 'video', 'audio'];
export const GALLERY_URL_TYPES = ['youtube', 'youtube_short', 'tiktok', 'instagram', 'facebook'];
export const GALLERY_PORTRAIT_TYPES = new Set(['tiktok', 'instagram', 'youtube_short']);

export function youtubeId(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.split('/').filter(Boolean)[0] || null;
    }
    const fromQuery = parsed.searchParams.get('v');
    if (fromQuery) return fromQuery;
    const parts = parsed.pathname.split('/').filter(Boolean);
    const marker = parts.findIndex((part) => part === 'embed' || part === 'shorts');
    if (marker >= 0) return parts[marker + 1] || null;
  } catch {
    /* fall through */
  }
  const match = String(url).match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/
  );
  return match?.[1] || null;
}

export function tiktokVideoId(url) {
  if (!url) return null;
  const match = String(url).match(/\/video\/(\d+)/);
  return match?.[1] || null;
}

export function instagramPath(url) {
  if (!url) return null;
  const match = String(url).match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match ? `${match[1]}/${match[2]}` : null;
}

export function detectGalleryTypeFromUrl(url) {
  const u = String(url || '').toLowerCase();
  if (!u) return null;
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('facebook.com') || u.includes('fb.watch')) return 'facebook';
  if (u.includes('youtube.com/shorts') || (u.includes('youtu.be/') && u.includes('shorts'))) {
    return 'youtube_short';
  }
  if (u.includes('youtube.com') || u.includes('youtu.be')) {
    return u.includes('/shorts/') ? 'youtube_short' : 'youtube';
  }
  return null;
}

export function youtubeEmbedSrc(id) {
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export function youtubeThumbnail(id) {
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export function tiktokEmbedSrc(id) {
  return id ? `https://www.tiktok.com/player/v1/${id}` : null;
}

export function instagramEmbedSrc(path) {
  return path ? `https://www.instagram.com/${path}/embed` : null;
}

export function facebookEmbedSrc(url) {
  return url
    ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`
    : null;
}

export function buildGalleryCard(item) {
  const data = {
    id: item.id,
    type: item.type,
    title: item.title,
    description: item.description,
    file_path: item.file_path,
    media_url: item.media_url,
    file_url: item.file_url || null,
    thumbnail_url: item.thumbnail_url || null,
    embed_src: item.embed_src || null,
    portrait: GALLERY_PORTRAIT_TYPES.has(item.type),
  };

  if (item.type === 'youtube' || item.type === 'youtube_short') {
    data.youtube_id = youtubeId(item.media_url);
    data.embed_src = data.embed_src || youtubeEmbedSrc(data.youtube_id);
    data.thumbnail_url = data.thumbnail_url || youtubeThumbnail(data.youtube_id);
  } else if (item.type === 'tiktok') {
    data.tiktok_id = tiktokVideoId(item.media_url);
    data.embed_src = data.embed_src || tiktokEmbedSrc(data.tiktok_id);
  } else if (item.type === 'instagram') {
    data.instagram_path = instagramPath(item.media_url);
    data.embed_src = data.embed_src || instagramEmbedSrc(data.instagram_path);
  } else if (item.type === 'facebook') {
    data.embed_src = data.embed_src || facebookEmbedSrc(item.media_url);
  }

  return data;
}
