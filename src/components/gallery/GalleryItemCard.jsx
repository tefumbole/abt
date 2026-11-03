import React, { useState } from 'react';
import { ExternalLink, Music, Play } from 'lucide-react';
import { buildGalleryCard, GALLERY_TYPES } from '@/utils/galleryEmbed';

function MediaFrame({ portrait, children }) {
  return (
    <div
      className={`relative w-full overflow-hidden bg-slate-900 ${
        portrait ? 'aspect-[9/16] max-h-[560px] mx-auto' : 'aspect-video'
      }`}
    >
      {children}
    </div>
  );
}

function EmbedIframe({ src, title }) {
  return (
    <iframe
      src={src}
      title={title || 'Gallery video'}
      className="absolute inset-0 h-full w-full border-0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
      loading="lazy"
    />
  );
}

export default function GalleryItemCard({ item, onImageClick }) {
  const card = buildGalleryCard(item);
  const [playing, setPlaying] = useState(!card.thumbnail_url && Boolean(card.embed_src));

  const openOriginal = () => {
    if (item.media_url) window.open(item.media_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col h-full">
      <div className="bg-slate-900">
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
          <div className="p-8 w-full text-center bg-gray-100">
            <Music className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
            <audio controls className="w-full">
              <source src={card.file_url} />
            </audio>
          </div>
        )}

        {card.embed_src && (
          <MediaFrame portrait={card.portrait}>
            {playing ? (
              <EmbedIframe src={card.embed_src} title={item.title} />
            ) : (
              <button
                type="button"
                className="absolute inset-0 group"
                onClick={() => setPlaying(true)}
                aria-label={`Play ${item.title || GALLERY_TYPES[item.type] || 'video'}`}
              >
                {card.thumbnail_url && (
                  <img
                    src={card.thumbnail_url}
                    alt={item.title || GALLERY_TYPES[item.type] || 'Gallery video'}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <span className="absolute inset-0 bg-black/25 group-hover:bg-black/35 transition-colors" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#D4AF37] text-[#003D82] shadow-lg group-hover:scale-105 transition-transform">
                    <Play className="w-7 h-7 ml-1 fill-current" />
                  </span>
                </span>
              </button>
            )}
          </MediaFrame>
        )}

        {!card.embed_src
          && !['image', 'video', 'audio'].includes(item.type)
          && item.media_url && (
          <a
            href={item.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[220px] items-center justify-center gap-2 p-8 text-center font-semibold text-white hover:text-[#D4AF37]"
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
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="inline-block text-xs font-semibold uppercase tracking-wide text-[#D4AF37]">
              {GALLERY_TYPES[item.type] || item.type}
            </span>
            {item.media_url && (
              <button
                type="button"
                onClick={openOriginal}
                className="inline-flex items-center gap-1 text-xs text-[#003D82] hover:underline"
              >
                Open <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
