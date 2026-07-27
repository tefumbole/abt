import React, { useEffect } from 'react';
import { ExternalLink, Music } from 'lucide-react';
import { buildGalleryCard, GALLERY_TYPES } from '@/utils/galleryEmbed';

function loadScriptOnce(src, id) {
  if (typeof document === 'undefined') return;
  if (document.getElementById(id)) return;
  const script = document.createElement('script');
  script.id = id;
  script.async = true;
  script.src = src;
  document.body.appendChild(script);
}

export default function GalleryItemCard({ item, onImageClick }) {
  const card = buildGalleryCard(item);

  useEffect(() => {
    if (item.type === 'tiktok') {
      loadScriptOnce('https://www.tiktok.com/embed.js', 'tiktok-embed-js');
      if (window.tiktokEmbed?.lib?.render) {
        try { window.tiktokEmbed.lib.render(); } catch { /* ignore */ }
      }
    }
    if (item.type === 'instagram') {
      loadScriptOnce('//www.instagram.com/embed.js', 'instagram-embed-js');
      if (window.instgrm?.Embeds?.process) {
        try { window.instgrm.Embeds.process(); } catch { /* ignore */ }
      }
    }
  }, [item.type, item.id, item.media_url]);

  return (
    <div className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col h-full">
      <div className="relative bg-gray-100 flex items-center justify-center overflow-hidden min-h-[280px]">
        {item.type === 'image' && card.file_url && (
          <img
            src={card.file_url}
            alt={item.title || 'Gallery image'}
            className="w-full h-full object-cover max-h-[420px] cursor-zoom-in"
            onClick={() => onImageClick?.(card.file_url, item.title)}
          />
        )}

        {item.type === 'video' && card.file_url && (
          <video controls playsInline className="w-full max-h-[420px] bg-black">
            <source src={card.file_url} />
          </video>
        )}

        {item.type === 'audio' && card.file_url && (
          <div className="p-8 w-full text-center">
            <Music className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
            <audio controls className="w-full">
              <source src={card.file_url} />
            </audio>
          </div>
        )}

        {(item.type === 'youtube' || item.type === 'youtube_short') && card.youtube_id && (
          <div className="w-full aspect-video">
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${card.youtube_id}`}
              title={item.title || 'YouTube video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {item.type === 'tiktok' && card.tiktok_id && (
          <blockquote
            className="tiktok-embed mx-auto"
            cite={item.media_url}
            data-video-id={card.tiktok_id}
            style={{ maxWidth: 605, minWidth: 325 }}
          >
            <section>
              <a target="_blank" rel="noopener noreferrer" href={item.media_url}>
                {item.title || 'TikTok video'}
              </a>
            </section>
          </blockquote>
        )}

        {item.type === 'instagram' && card.instagram_path && (
          <blockquote
            className="instagram-media mx-auto"
            data-instgrm-permalink={`https://www.instagram.com/${card.instagram_path}/`}
            data-instgrm-version="14"
            style={{ maxWidth: 540, minWidth: 326, width: '100%' }}
          />
        )}

        {item.type === 'facebook' && item.media_url && (
          <div className="w-full aspect-video">
            <iframe
              className="w-full h-full"
              src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(item.media_url)}&show_text=false`}
              style={{ border: 'none', overflow: 'hidden' }}
              scrolling="no"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              title={item.title || 'Facebook video'}
            />
          </div>
        )}

        {!['image', 'video', 'audio', 'youtube', 'youtube_short', 'tiktok', 'instagram', 'facebook'].includes(item.type)
          && item.media_url && (
          <a
            href={item.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#003D82] font-semibold p-8 text-center hover:underline inline-flex items-center gap-2"
          >
            View media <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      <div className="p-5 flex-grow">
        {item.title && (
          <h3 className="text-lg font-bold text-[#003D82] mb-2">{item.title}</h3>
        )}
        {item.description && (
          <p className="text-gray-600 text-sm leading-relaxed">{item.description}</p>
        )}
        {item.type !== 'image' && (
          <span className="inline-block mt-3 text-xs font-semibold uppercase tracking-wide text-[#D4AF37]">
            {GALLERY_TYPES[item.type] || item.type}
          </span>
        )}
      </div>
    </div>
  );
}
