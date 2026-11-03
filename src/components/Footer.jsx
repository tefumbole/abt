import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, Mail } from 'lucide-react';
import { getSystemSettings } from '@/services/settingsService';
import { usePageT } from '@/hooks/useSiteLabel';
import {
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  WHATSAPP_PHONE,
  COMPANY_NAME,
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
    <div className="relative overflow-hidden border-b border-white/10 bg-[#003D82]/35">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#0b1224] to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#0b1224] to-transparent z-10" />
      <motion.div
        className="flex whitespace-nowrap py-2 gap-8"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 26, ease: 'linear', repeat: Infinity }}
      >
        {loop.map((phrase, i) => (
          <span
            key={`${phrase}-${i}`}
            className="inline-flex items-center gap-8 text-[11px] md:text-xs tracking-[0.16em] uppercase font-semibold"
          >
            <span className={i % 2 === 0 ? 'text-[#D4AF37]' : 'text-white/65'}>{phrase}</span>
            <span className="text-[#D4AF37]/40" aria-hidden>
              ◆
            </span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function Footer() {
  const tf = usePageT('footer');
  const currentYear = new Date().getFullYear();
  const [settings, setSettings] = useState({
    developed_by: COMPANY_NAME,
    copyright_text: 'All rights reserved',
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getSystemSettings();
        if (data) {
          setSettings((prev) => ({
            ...prev,
            developed_by: data.developed_by || prev.developed_by,
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
    <footer className="relative mt-auto text-white overflow-hidden bg-[#0b1224]">
      <MarqueeBand />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-center md:text-left">
          <p className="text-white/50 text-xs">
            © {currentYear} {COMPANY_NAME}. {copyrightLabel}
          </p>
          <p className="text-white/40 text-[11px]">
            {tf('developed_by', 'Developed by')}{' '}
            <span className="text-white/65 font-medium">{settings.developed_by}</span>
          </p>
          <div className="flex items-center justify-center md:justify-end gap-4 text-xs text-white/60">
            <a href={`tel:${WHATSAPP_PHONE}`} className="inline-flex items-center gap-1.5 hover:text-[#D4AF37]">
              <Phone className="w-3.5 h-3.5" />
              {CONTACT_PHONE_DISPLAY}
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-1.5 hover:text-[#D4AF37]">
              <Mail className="w-3.5 h-3.5" />
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
