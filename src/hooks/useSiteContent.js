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
    (async () => {
      try {
        const next = await getPublicSiteContent();
        if (!cancelled) setData(next || { landingMenu: [], pages: {} });
      } catch (err) {
        console.warn('Site content unavailable, using defaults', err?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
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
