import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Loader2, X } from 'lucide-react';
import { COMPANY_NAME } from '@/constants/branding';
import GalleryItemCard from '@/components/gallery/GalleryItemCard';
import { listPublishedGalleryItems } from '@/services/galleryService';

export default function GalleryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listPublishedGalleryItems();
        if (!cancelled) setItems(data);
      } catch (err) {
        console.error('Gallery load failed', err);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <Helmet>
        <title>Gallery | {COMPANY_NAME}</title>
        <meta
          name="description"
          content={`Explore events, projects, and highlights from ${COMPANY_NAME} — photos, videos, and social media moments.`}
        />
      </Helmet>

      <section className="relative py-20 bg-[#003D82] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_#D4AF37_0%,_transparent_55%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-bold mb-4"
          >
            Our <span className="text-[#D4AF37]">Gallery</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-xl text-white/90 max-w-3xl mx-auto font-light"
          >
            Events, projects, and moments from {COMPANY_NAME}.
          </motion.p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-20 text-[#003D82]">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Gallery items will appear here once added by an administrator.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {items.map((item) => (
                <GalleryItemCard
                  key={item.id}
                  item={item}
                  onImageClick={(src, alt) => setLightbox({ src, alt })}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white text-3xl leading-none"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={lightbox.src}
            alt={lightbox.alt || ''}
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
