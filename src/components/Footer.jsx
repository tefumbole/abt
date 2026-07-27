import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Phone, Mail, Globe, MapPin, ArrowUpRight } from 'lucide-react';
import WhatsAppButton from '@/components/WhatsAppButton';
import BrandLogo from '@/components/BrandLogo';
import { getSystemSettings } from '@/services/settingsService';
import { useSiteLabel } from '@/hooks/useSiteLabel';
import { usePageT } from '@/hooks/useSiteLabel';
import {
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  WEBSITE_HOST,
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
  const tl = useSiteLabel();
  const tf = usePageT('footer');
  const currentYear = new Date().getFullYear();
  const [settings, setSettings] = useState({
    developed_by: COMPANY_NAME,
    copyright_text: 'All rights reserved',
    logo_url: null,
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
            logo_url: data.logo_url,
          }));
        }
      } catch {
        console.warn('Footer: using default settings');
      }
    };
    fetchSettings();
  }, []);

  const quickLinks = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/about#contact' },
    { name: 'Training', path: '/trainings' },
    { name: 'Gallery', path: '/gallery' },
    { name: 'Shareholders Portal', path: '/shareholders' },
  ];

  // Prefer a clean rights line; settings sometimes store a full dated sentence.
  const rawCopyright = String(settings.copyright_text || '').trim();
  const copyrightLabel =
    !rawCopyright ||
    /^all rights reserved$/i.test(rawCopyright) ||
    /\d{4}/.test(rawCopyright)
      ? tf('all_rights_reserved', 'All rights reserved')
      : rawCopyright;

  return (
    <footer className="relative mt-auto text-white overflow-hidden bg-[#0b1224]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 left-1/3 w-64 h-32 bg-[#003D82]/40 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#D4AF37]/8 blur-3xl rounded-full" />
      </div>

      <MarqueeBand />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 md:py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start">
          {/* Brand — compact */}
          <div className="md:col-span-5 space-y-2">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <BrandLogo
                alt={COMPANY_NAME}
                className="h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                variant="onDark"
                src={settings.logo_url || undefined}
                preferSystemLogo={!settings.logo_url}
              />
              <div className="leading-tight">
                <p className="text-lg md:text-xl font-bold tracking-tight">
                  <span className="text-white">Alpha </span>
                  <span className="text-[#D4AF37]">Bridge</span>
                  <span className="text-white/85 font-semibold"> Technologies</span>
                </p>
              </div>
            </Link>
            <p className="text-xs md:text-sm text-white/55 leading-snug max-w-md">
              {tf(
                'tagline',
                'Your Technology Bridge to Kigali — IT, networking, security & AV.'
              )}
            </p>
            <div className="flex items-center gap-1.5 text-white/45 text-[11px]">
              <MapPin className="w-3 h-3 text-[#D4AF37]" />
              {tf('location', 'Kigali, Rwanda')}
            </div>
          </div>

          {/* Links */}
          <div className="md:col-span-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4AF37] mb-2.5">
              {tf('quick_links', 'Quick Links')}
            </h3>
            <nav className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {quickLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="group inline-flex items-center gap-0.5 text-white/75 hover:text-[#D4AF37] transition-colors text-sm"
                >
                  {tl('footer', link.name)}
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </nav>
          </div>

          {/* Contact */}
          <div className="md:col-span-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4AF37] mb-2.5">
              {tf('contact_us', 'Contact Us')}
            </h3>
            <div className="space-y-2">
              <WhatsAppButton
                text={tf('chat_now', 'Chat now')}
                className="h-9 text-sm bg-[#25D366] hover:bg-[#1EBE57]"
              />
              <a
                href={`tel:${WHATSAPP_PHONE}`}
                className="flex items-center gap-2.5 text-white/75 hover:text-[#D4AF37] transition-colors text-sm"
              >
                <Phone className="w-3.5 h-3.5 shrink-0 text-[#D4AF37]/80" />
                <span>{CONTACT_PHONE_DISPLAY}</span>
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center gap-2.5 text-white/75 hover:text-[#D4AF37] transition-colors text-sm"
              >
                <Mail className="w-3.5 h-3.5 shrink-0 text-[#D4AF37]/80" />
                <span>{CONTACT_EMAIL}</span>
              </a>
              <a
                href={`https://${WEBSITE_HOST}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-white/75 hover:text-[#D4AF37] transition-colors text-sm"
              >
                <Globe className="w-3.5 h-3.5 shrink-0 text-[#D4AF37]/80" />
                <span>{WEBSITE_HOST}</span>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-center sm:text-left">
          <p className="text-white/40 text-xs">
            © {currentYear} {COMPANY_NAME}. {copyrightLabel}
          </p>
          <p className="text-white/30 text-[11px]">
            {tf('developed_by', 'Developed by')}{' '}
            <span className="text-white/50 font-medium">{settings.developed_by}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
