import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Globe2,
  Target,
  Users,
  Award,
  Briefcase,
  MapPin,
  Phone,
  Mail,
  Clock,
  ArrowRight,
} from 'lucide-react';
import WhatsAppButton from '@/components/WhatsAppButton';
import MembersSection from '@/components/MembersSection';
import { Button } from '@/components/ui/button';
import { useSiteContent } from '@/hooks/useSiteContent';

const DEFAULT_ABOUT_IMAGE =
  'https://horizons-cdn.hostinger.com/81ef3422-3855-479e-bfe8-28a4ceb0df39/513a28b3-47b7-490b-b30a-f9398973361b-a4hCG.png';

function AboutPage() {
  const { field } = useSiteContent();
  const location = useLocation();

  const stats = [
    { label: 'Years Experience', value: field('about', 'stat_years', '15+') },
    { label: 'Projects Completed', value: field('about', 'stat_projects', '500+') },
    { label: 'Team Members', value: field('about', 'stat_team', '50+') },
    { label: 'Global Partners', value: field('about', 'stat_partners', '20+') },
  ];

  const aboutImage = field('about', 'about_image', '') || DEFAULT_ABOUT_IMAGE;
  const phone = field('contact', 'phone', '+250 794 006 160');
  const email = field('contact', 'email', 'info@alpha-bridge.net');

  useEffect(() => {
    if (location.hash === '#contact') {
      const el = document.getElementById('contact');
      if (el) {
        const t = window.setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
        return () => window.clearTimeout(t);
      }
    }
    return undefined;
  }, [location.hash, location.pathname]);

  return (
    <>
      <Helmet>
        <title>About Alpha Bridge | Our Vision & Team</title>
        <meta
          name="description"
          content="Learn about Alpha Bridge — our history, mission, leadership, and commitment to technological excellence in Rwanda and beyond."
        />
      </Helmet>

      <section className="relative py-20 bg-[#003D82] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')] bg-cover bg-center" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-bold mb-6"
          >
            {field('about', 'hero_title', 'Bridging Technology & Innovation')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto font-light"
          >
            {field(
              'about',
              'hero_subtitle',
              'We are a premier IT consultancy and infrastructure firm dedicated to transforming businesses through cutting-edge technology solutions.'
            )}
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-8"
          >
            <a
              href="#contact"
              className="inline-flex items-center gap-2 text-[#D4AF37] font-semibold hover:text-white transition-colors"
            >
              Contact Us <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold text-[#003D82] mb-6">
                {field('about', 'mission_heading', 'Our Mission')}
              </h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                {field(
                  'about',
                  'mission_text',
                  'To empower organizations in Africa and beyond with robust, scalable, and secure technology infrastructure. We strive to be the bridge that connects complex technological challenges with simple, effective, and sustainable solutions.'
                )}
              </p>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Target className="w-6 h-6 text-[#003D82]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Excellence</h3>
                    <p className="text-sm text-gray-500">World-class standards</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Globe2 className="w-6 h-6 text-[#003D82]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Global Reach</h3>
                    <p className="text-sm text-gray-500">International partnerships</p>
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative rounded-2xl overflow-hidden shadow-2xl"
            >
              <img src={aboutImage} alt="Team Collaboration" className="w-full h-full object-cover" />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl font-bold text-[#003D82] mb-2">{stat.value}</div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <MembersSection />

      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-[#003D82] mb-12">
            {field('about', 'values_heading', 'Our Core Values')}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                title: 'Client First',
                desc: "We prioritize our clients' needs and success above all else.",
              },
              {
                icon: Award,
                title: 'Integrity',
                desc: 'We conduct business with transparency, honesty, and ethical standards.',
              },
              {
                icon: Briefcase,
                title: 'Innovation',
                desc: 'We constantly evolve and adapt to the latest technological advancements.',
              },
            ].map((val, i) => (
              <div key={i} className="p-6 bg-gray-50 rounded-xl hover:shadow-lg transition-shadow">
                <val.icon className="w-12 h-12 text-[#D4AF37] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#003D82] mb-2">{val.title}</h3>
                <p className="text-gray-600">{val.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact under About Us — replaces top-level Contact Us menu */}
      <section id="contact" className="py-16 bg-gray-50 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#003D82] mb-4">
              {field('contact', 'heading', 'Get in Touch')}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {field(
                'contact',
                'intro',
                "Have a question, need assistance, or want to explore partnership opportunities? We're here to help. Reach out to the Alpha Bridge team today."
              )}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-10">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <MapPin className="w-6 h-6 text-[#003D82] mb-3" />
              <h3 className="font-semibold text-[#003D82] mb-2">Office</h3>
              <p className="text-sm text-gray-600">
                {field('contact', 'office_name', 'Alpha Bridge.')}
                <br />
                {field('contact', 'office_line1', 'Norrsken House Kigali')}
                <br />
                {field('contact', 'office_line2', 'Kigali, Rwanda')}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <Phone className="w-6 h-6 text-[#D4AF37] mb-3" />
              <h3 className="font-semibold text-[#003D82] mb-2">Phone & Email</h3>
              <p className="text-sm text-gray-600">
                <a href={`tel:${phone.replace(/\s/g, '')}`} className="hover:text-[#003D82]">
                  {phone}
                </a>
                <br />
                <a href={`mailto:${email}`} className="hover:text-[#003D82]">
                  {email}
                </a>
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <Clock className="w-6 h-6 text-[#003D82] mb-3" />
              <h3 className="font-semibold text-[#003D82] mb-2">Business Hours</h3>
              <p className="text-sm text-gray-600">
                Mon–Fri: {field('contact', 'hours_weekday', '9:00 AM - 6:00 PM')}
                <br />
                Sat–Sun: {field('contact', 'hours_weekend', 'Closed')}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <WhatsAppButton className="bg-[#D4AF37] text-[#003D82] font-bold px-8 py-3 rounded-full" />
            <Button asChild variant="outline" className="border-[#003D82] text-[#003D82]">
              <Link to="/contact">
                <Mail className="w-4 h-4 mr-2" />
                Open full contact form
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-r from-[#003D82] to-[#002855] text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-6">
            {field('about', 'cta_heading', 'Ready to work with us?')}
          </h2>
          <p className="text-xl mb-8 opacity-90">
            {field('about', 'cta_text', "Let's build something extraordinary together.")}
          </p>
          <WhatsAppButton className="bg-[#D4AF37] text-[#003D82] font-bold text-lg px-8 py-4 rounded-full hover:bg-white hover:scale-105 transition-all" />
        </div>
      </section>
    </>
  );
}

export default AboutPage;
