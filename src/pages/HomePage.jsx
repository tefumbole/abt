import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import WhatsAppButton from '@/components/WhatsAppButton';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import BrandLogo from '@/components/BrandLogo';
import { usePageT } from '@/hooks/useSiteLabel';
import { COMPANY_NAME, HERO_IMAGE_URL } from '@/constants/branding';
import { useSiteContent } from '@/hooks/useSiteContent';

function HomePage() {
  const th = usePageT('home');
  const { field } = useSiteContent();
  const heroImage = field('home', 'hero_image', '') || HERO_IMAGE_URL;
  const heroTitleHtml = field(
    'home',
    'hero_title',
    `Your Technology Bridge to <span class="text-[#D4AF37]">Kigali</span>`
  );
  const heroSubtitle = field(
    'home',
    'hero_subtitle',
    th('hero_subtitle', 'Professional IT Consultancy, Enterprise Networking, and Audio-Visual Production, Cloud, AI and Cyber')
  );
  const ctaPrimary = field('home', 'cta_primary', th('get_free_quote', 'Get a Free Quote'));

  return (
    <>
      <Helmet>
        <title>{COMPANY_NAME} | IT Consultancy & AV Solutions</title>
        <meta name="description" content={`${COMPANY_NAME} — IT consultancy, networks, CCTV security, and professional sound/screen/lighting solutions. Chat with us on WhatsApp for a quote.`} />
      </Helmet>

      <section className="relative min-h-[calc(100svh-5.75rem)] sm:min-h-[calc(100svh-4.75rem)] flex flex-col items-center justify-center overflow-hidden py-20 md:py-0">
        <motion.div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${heroImage})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 12, ease: 'easeOut' }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <motion.div
            className="absolute inset-0 bg-gradient-to-t from-[#003D82]/90 via-[#003D82]/30 to-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
          />
        </motion.div>

        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-[#D4AF37]/40"
            style={{ left: `${10 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
            animate={{ y: [0, -20, 0], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center w-full mt-20 md:mt-0">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="mb-8 flex flex-col items-center"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <BrandLogo
                alt={COMPANY_NAME}
                className="h-24 md:h-32 w-auto object-contain mb-6 drop-shadow-2xl"
                variant="onDark"
                preferSystemLogo={false}
              />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 drop-shadow-2xl tracking-tight"
              dangerouslySetInnerHTML={{ __html: heroTitleHtml }}
            />
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.55 }}
              className="text-xl md:text-2xl text-white/90 font-light max-w-3xl mx-auto drop-shadow-md"
            >
              {heroSubtitle}
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.75 }}
            className="w-full flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <Link to="/contact">
              <Button className="bg-[#D4AF37] hover:bg-[#b5952f] text-[#003D82] h-14 px-8 text-lg font-bold shadow-[0_0_15px_rgba(212,175,55,0.4)] w-full sm:w-auto rounded-full hover:scale-105 transition-transform">
                {ctaPrimary} <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <WhatsAppButton className="h-14 px-8 text-lg font-bold rounded-full shadow-xl hover:shadow-2xl" />
          </motion.div>
        </div>
      </section>
    </>
  );
}

export default HomePage;
