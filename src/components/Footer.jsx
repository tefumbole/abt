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
  'Alpha Bridge Technologies',
  'Cloud · AI · Cyber',
];

function MarqueeBand() {
  const loop = [...MARQUEE_PHRASES, ...MARQUEE_PHRASES];
  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-[#003D82]/40">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0b1224] to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0b1224] to-transparent z-10" />
      <motion.div
        className="flex whitespace-nowrap py-3.5 gap-10"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 28, ease: 'linear', repeat: Infinity }}
      >
        {loop.map((phrase, i) => (
          <span
            key={`${phrase}-${i}`}
            className="inline-flex items-center gap-10 text-sm md:text-base tracking-[0.18em] uppercase font-semibold"
          >
            <span className={i % 2 === 0 ? 'text-[#D4AF37]' : 'text-white/70'}>{phrase}</span>
            <span className="text-[#D4AF37]/50" aria-hidden>
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

  const copyrightLabel =
    !settings.copyright_text || settings.copyright_text === 'All rights reserved'
      ? tf('all_rights_reserved', 'All rights reserved')
      : settings.copyright_text;

  return (
    <footer className="relative mt-auto text-white overflow-hidden bg-[#0b1224]">
      {/* Atmosphere */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[80%] h-48 bg-[#003D82]/50 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-[#D4AF37]/10 blur-3xl rounded-full" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(212,175,55,0.55) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      {/* Animated brand ribbon */}
      <MarqueeBand />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-16">
        {/* Brand wordmark */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center md:text-left"
        >
          <Link to="/" className="inline-flex flex-col md:flex-row items-center md:items-end gap-4 group">
            <BrandLogo
              alt={COMPANY_NAME}
              className="h-[56px] w-auto object-contain transition-transform duration-500 group-hover:scale-105"
              variant="onDark"
              src={settings.logo_url || undefined}
              preferSystemLogo={!settings.logo_url}
            />
            <div>
              <motion.h2
                className="text-3xl md:text-5xl font-bold tracking-tight"
                initial={{ opacity: 0.85 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                <span className="text-white">Alpha </span>
                <span className="text-[#D4AF37]">Bridge</span>
                <span className="block md:inline text-white/90 md:ml-2 text-2xl md:text-3xl font-semibold tracking-wide">
                  Technologies
                </span>
              </motion.h2>
              <p className="mt-2 text-sm md:text-base text-white/60 max-w-xl">
                {tf(
                  'tagline',
                  'Your Technology Bridge to Kigali. Professional IT, networking, security, and audio-visual solutions.'
                )}
              </p>
            </div>
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="space-y-4"
          >
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">
              {tf('explore', 'Explore')}
            </h3>
            <p className="text-white/55 text-sm leading-relaxed">
              Building reliable infrastructure and digital experiences across Rwanda and beyond.
            </p>
            <div className="flex items-center gap-2 text-white/50 text-xs">
              <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
              {tf('location', 'Kigali, Rwanda')}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D4AF37] mb-4">
              {tf('quick_links', 'Quick Links')}
            </h3>
            <nav className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {quickLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="group inline-flex items-center gap-1 text-white/75 hover:text-[#D4AF37] transition-colors text-sm"
                >
                  {tl('footer', link.name)}
                  <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-0.5 group-hover:opacity-100 transition-all" />
                </Link>
              ))}
            </nav>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
          >
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D4AF37] mb-4">
              {tf('contact_us', 'Contact Us')}
            </h3>
            <div className="space-y-3">
              <WhatsAppButton
                text={tf('chat_now', 'Chat now')}
                className="w-full sm:w-auto bg-[#25D366] hover:bg-[#1EBE57] shadow-lg shadow-emerald-900/30"
              />
              <a
                href={`tel:${WHATSAPP_PHONE}`}
                className="flex items-center space-x-3 text-white/75 hover:text-[#D4AF37] transition-colors text-sm"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10">
                  <Phone className="w-4 h-4" />
                </span>
                <span>{CONTACT_PHONE_DISPLAY}</span>
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center space-x-3 text-white/75 hover:text-[#D4AF37] transition-colors text-sm"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10">
                  <Mail className="w-4 h-4" />
                </span>
                <span>{CONTACT_EMAIL}</span>
              </a>
              <a
                href={`https://${WEBSITE_HOST}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-3 text-white/75 hover:text-[#D4AF37] transition-colors text-sm"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10">
                  <Globe className="w-4 h-4" />
                </span>
                <span>{WEBSITE_HOST}</span>
              </a>
            </div>
          </motion.div>
        </div>

        <div className="mt-14 pt-8 border-t border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-center md:text-left">
          <p className="text-white/45 text-sm">
            © {currentYear} {COMPANY_NAME}. {copyrightLabel}
          </p>
          <p className="text-white/35 text-xs">
            {tf('developed_by', 'Developed by')}{' '}
            <span className="text-white/55 font-medium">{settings.developed_by}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
