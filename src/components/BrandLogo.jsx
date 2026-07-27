import React, { useState, useEffect, useCallback } from 'react';
import { DEFAULT_LOGO_URL, resolveLogoUrl, isValidLogoUrl } from '@/constants/branding';
import { getSystemSettings } from '@/services/settingsService';

/**
 * Renders the company logo. Uses a local transparent PNG by default.
 */
const BrandLogo = ({
  alt = 'Alpha Bridge',
  className = 'h-[40px] md:h-[50px] lg:h-[60px] w-auto object-contain',
  variant = 'onDark',
  preferSystemLogo = true,
  src: srcOverride,
}) => {
  const [src, setSrc] = useState(resolveLogoUrl(srcOverride));

  const applyFallback = useCallback(() => {
    setSrc(DEFAULT_LOGO_URL);
  }, []);

  useEffect(() => {
    if (srcOverride) {
      setSrc(resolveLogoUrl(srcOverride));
      return undefined;
    }
    if (!preferSystemLogo) {
      setSrc(DEFAULT_LOGO_URL);
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const settings = await getSystemSettings();
        const custom = settings?.logo_url || settings?.system_logo;
        if (!cancelled && isValidLogoUrl(custom)) {
          setSrc(custom.trim());
        }
      } catch {
        /* keep default */
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [preferSystemLogo, srcOverride]);

  return (
    <span className="inline-flex items-center bg-transparent leading-none">
      <img
        src={src}
        alt={alt}
        className={`${className} bg-transparent`.trim()}
        onError={applyFallback}
        decoding="async"
      />
    </span>
  );
};

export default BrandLogo;
