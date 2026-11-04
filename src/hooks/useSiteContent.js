import { useEffect, useState } from 'react';
import { getPublicSiteContent, pageField } from '@/services/siteContentService';

/**
 * Load public site content (menus + page fields). Falls back to empty until loaded.
 */
export function useSiteContent() {
  const [data, setData] = useState({ landingMenu: [], pages: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async ({ force = false } = {}) => {
      try {
        const next = await getPublicSiteContent({ force });
        if (!cancelled) setData(next || { landingMenu: [], pages: {} });
      } catch (err) {
        console.warn('Site content unavailable, using defaults', err?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const onUpdated = () => load({ force: true });
    window.addEventListener('alphabridge:site-content-updated', onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('alphabridge:site-content-updated', onUpdated);
    };
  }, []);

  const field = (page, key, fallback = '') => pageField(data.pages, page, key, fallback);

  return {
    loading,
    landingMenu: data.landingMenu || [],
    pages: data.pages || {},
    field,
  };
}
