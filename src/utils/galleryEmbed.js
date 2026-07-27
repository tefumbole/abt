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

export function youtubeId(url) {
  if (!url) return null;
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
  if (u.includes('youtube.com/shorts') || u.includes('youtu.be/') && u.includes('shorts')) {
    return 'youtube_short';
  }
  if (u.includes('youtube.com') || u.includes('youtu.be')) {
    return u.includes('/shorts/') ? 'youtube_short' : 'youtube';
  }
  return null;
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
  };

  if (item.type === 'youtube' || item.type === 'youtube_short') {
    data.youtube_id = youtubeId(item.media_url);
  } else if (item.type === 'tiktok') {
    data.tiktok_id = tiktokVideoId(item.media_url);
  } else if (item.type === 'instagram') {
    data.instagram_path = instagramPath(item.media_url);
  }

  return data;
}
