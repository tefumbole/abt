import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, Mail, MapPin } from 'lucide-react';
import { getSystemSettings } from '@/services/settingsService';
import { usePageT } from '@/hooks/useSiteLabel';
import {
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  WHATSAPP_PHONE,
  COMPANY_NAME,
  COMPANY_NAME_SHORT,
  OFFICE_NAME,
  OFFICE_CITY,
  OFFICE_MAPS_URL,
} from '@/constants/branding';

const MARQUEE_PHRASES = [
  'Alpha Bridge Technologies',
  'Your Technology Bridge to Kigali',
  'IT · Networks · Security · AV',
  'Engineering Precision',
  'Cloud · AI · Cyber',
];

function MarqueeBand() {
  const loop = [...MARQUEE_PHRASES, ...MARQUEE_PHRASES];
  return (
    <div className="relative overflow-hidden bg-[#001f42] border-t border-[#D4AF37]/40">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#001f42] to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#001f42] to-transparent z-10" />
      <motion.div
        className="flex whitespace-nowrap py-1.5 gap-8"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 26, ease: 'linear', repeat: Infinity }}
      >
        {loop.map((phrase, i) => (
          <span
            key={`${phrase}-${i}`}
            className="inline-flex items-center gap-8 text-[10px] sm:text-xs tracking-[0.16em] uppercase font-semibold"
          >
            <span className={i % 2 === 0 ? 'text-[#D4AF37]' : 'text-white'}>{phrase}</span>
            <span className="text-[#D4AF37]" aria-hidden>
              ◆
            </span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function cleanDevelopedBy(value) {
  const text = String(value || '')
    .replace(/[+]?\d[\d().\s-]{6,}\d/g, '')
    .replace(/[·|•,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || COMPANY_NAME_SHORT;
}

function Footer() {
  const tf = usePageT('footer');
  const currentYear = new Date().getFullYear();
  const [settings, setSettings] = useState({
    developed_by: COMPANY_NAME_SHORT,
    copyright_text: 'All rights reserved',
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getSystemSettings();
        if (data) {
          setSettings((prev) => ({
            ...prev,
            developed_by: cleanDevelopedBy(data.developed_by || prev.developed_by),
            copyright_text: data.copyright_text || prev.copyright_text,
          }));
        }
      } catch {
        console.warn('Footer: using default settings');
      }
    };
    fetchSettings();
  }, []);

  const rawCopyright = String(settings.copyright_text || '').trim();
  const copyrightLabel =
    !rawCopyright
    || /^all rights reserved$/i.test(rawCopyright)
    || /\d{4}/.test(rawCopyright)
      ? tf('all_rights_reserved', 'All rights reserved')
      : rawCopyright;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 text-white">
      <div className="border-t-2 border-[#D4AF37] bg-[#003D82]">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-1.5 sm:py-2">
          <div className="flex flex-wrap items-center justify-center sm:justify-between gap-x-4 gap-y-1 text-center text-[11px] sm:text-sm font-semibold">
            <p className="text-white">
              © {currentYear} {COMPANY_NAME}.{' '}
              <span className="text-[#D4AF37]">{copyrightLabel}</span>
            </p>
            <p className="text-white">
              {tf('developed_by', 'Developed by')}{' '}
              <span className="text-[#D4AF37]">{settings.developed_by}</span>
            </p>
            <a
              href={OFFICE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#D4AF37] hover:text-white underline underline-offset-2"
            >
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              {OFFICE_NAME}, {OFFICE_CITY}
            </a>
            <div className="flex flex-wrap items-center justify-center gap-x-4 text-white">
              <a href={`tel:${WHATSAPP_PHONE}`} className="inline-flex items-center gap-1 hover:text-[#D4AF37]">
                <Phone className="w-3.5 h-3.5 text-[#D4AF37]" />
                {CONTACT_PHONE_DISPLAY}
              </a>
              <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-1 hover:text-[#D4AF37]">
                <Mail className="w-3.5 h-3.5 text-[#D4AF37]" />
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </div>
      <MarqueeBand />
    </footer>
  );
}

export default Footer;
