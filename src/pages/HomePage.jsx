import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import WhatsAppButton from '@/components/WhatsAppButton';
import { getAllEvents } from '@/services/eventService';
import { Network, Shield, Mic, Monitor, CheckCircle2, Zap, TrendingUp, Mail, Building2, Church, Calendar, School, Heart, Home, Cable, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import BrandLogo from '@/components/BrandLogo';
import { usePageT } from '@/hooks/useSiteLabel';
import { useSiteLabel } from '@/hooks/useSiteLabel';
import { COMPANY_NAME, HERO_IMAGE_URL } from '@/constants/branding';

function HomePage() {
  const th = usePageT('home');
  const tl = useSiteLabel();
  const navigate = useNavigate();
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  useEffect(() => {
    let isMounted = true;
    const initData = async () => {
      try {
        const events = await getAllEvents();
        if (isMounted) {
          setUpcomingEvents(Array.isArray(events) ? events.slice(0, 3) : []);
        }
      } catch (error) {
        console.error("HomePage: Failed to load events", error);
        if (isMounted) setUpcomingEvents([]);
      }
    };
    initData();
    return () => {
      isMounted = false;
    };
  }, []);
  const services = [{
    icon: <Network className="w-12 h-12" />,
    title: tl('home', 'IT Consultancy'),
    description: tl('home', 'Enterprise-grade IT solutions and infrastructure planning')
  }, {
    icon: <Network className="w-12 h-12" />,
    title: tl('home', 'Networks'),
    description: tl('home', 'Professional networking design, deployment, and management')
  }, {
    icon: <Shield className="w-12 h-12" />,
    title: tl('home', 'CCTV & Security'),
    description: tl('home', 'Advanced surveillance and security systems')
  }, {
    icon: <Mic className="w-12 h-12" />,
    title: tl('home', 'Sound & Audio'),
    description: tl('home', 'Professional audio engineering for events and venues')
  }, {
    icon: <Monitor className="w-12 h-12" />,
    title: tl('home', 'Screens & Lighting'),
    description: tl('home', 'LED screens and professional lighting solutions')
  }, {
    icon: <Cable className="w-12 h-12" />,
    title: tl('home', 'Fiber Optics'),
    description: tl('home', 'High-speed fiber connectivity and splicing services')
  }];
  const whyChooseUs = [{
    icon: <CheckCircle2 className="w-10 h-10" />,
    title: tl('home', 'Engineering Standards'),
    description: tl('home', 'Built with precision and best practices')
  }, {
    icon: <Shield className="w-10 h-10" />,
    title: tl('home', 'Reliability'),
    description: tl('home', 'Dependable systems you can trust')
  }, {
    icon: <Zap className="w-10 h-10" />,
    title: tl('home', 'Fast Support'),
    description: tl('home', 'Quick response times and expert assistance')
  }, {
    icon: <TrendingUp className="w-10 h-10" />,
    title: tl('home', 'Scalable Solutions'),
    description: tl('home', 'Systems that grow with your needs')
  }];
  const industries = [{
    icon: <Building2 className="w-10 h-10" />,
    name: tl('home', 'Companies')
  }, {
    icon: <Church className="w-10 h-10" />,
    name: tl('home', 'Churches')
  }, {
    icon: <Calendar className="w-10 h-10" />,
    name: tl('home', 'Events')
  }, {
    icon: <School className="w-10 h-10" />,
    name: tl('home', 'Schools')
  }, {
    icon: <Heart className="w-10 h-10" />,
    name: tl('home', 'NGOs')
  }, {
    icon: <Home className="w-10 h-10" />,
    name: tl('home', 'Homes')
  }];
  const testimonials = [{
    name: 'Client A',
    role: tl('home', 'CEO, Tech Company'),
    content: tl('home', 'Alpha Bridge delivered exceptional networking solutions for our office. Professional and reliable.')
  }, {
    name: 'Client B',
    role: tl('home', 'Event Organizer'),
    content: tl('home', 'Their sound and lighting setup made our event unforgettable. Highly recommended!')
  }, {
    name: 'Client C',
    role: tl('home', 'School Administrator'),
    content: tl('home', 'The CCTV system they installed has greatly improved our campus security.')
  }];

  return <>
      <Helmet>
        <title>{COMPANY_NAME} | IT Consultancy & AV Solutions</title>
        <meta name="description" content={`${COMPANY_NAME} — IT consultancy, networks, CCTV security, and professional sound/screen/lighting solutions. Chat with us on WhatsApp for a quote.`} />
      </Helmet>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden py-20 md:py-0">
        <motion.div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${HERO_IMAGE_URL})`,
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
             >
               {th('hero_title_line1', 'Your Technology Bridge to')}{' '}
               <motion.span
                 className="text-[#D4AF37] inline-block"
                 animate={{ scale: [1, 1.03, 1] }}
                 transition={{ duration: 2.5, repeat: Infinity }}
               >
                 {th('hero_title_highlight', 'Kigali')}
               </motion.span>
             </motion.h1>
             <motion.p
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ duration: 0.8, delay: 0.55 }}
               className="text-xl md:text-2xl text-white/90 font-light max-w-3xl mx-auto drop-shadow-md"
             >
                {th('hero_subtitle', 'Professional IT Consultancy, Enterprise Networking, and Audio-Visual Production, Cloud, AI and Cyber')}
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
                  {th('get_free_quote', 'Get a Free Quote')} <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
            </Link>

            <WhatsAppButton className="h-14 px-8 text-lg font-bold rounded-full shadow-xl hover:shadow-2xl" />

          </motion.div>
        </div>
      </section>

      {/* Upcoming Events Section (Dynamic) */}
      {upcomingEvents && upcomingEvents.length > 0 && <section className="py-16 bg-gray-50">
           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
             <div className="text-center mb-12">
               <h2 className="text-4xl font-bold text-[#003D82] mb-4">{th('upcoming_events', 'Upcoming Events')}</h2>
               <p className="text-xl text-gray-600">{th('upcoming_events_subtitle', 'Join us at our next gathering')}</p>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {upcomingEvents.map(evt => <motion.div key={evt?.id || Math.random().toString()} initial={{
            opacity: 0,
            y: 20
          }} whileInView={{
            opacity: 1,
            y: 0
          }} viewport={{
            once: true
          }} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 hover:shadow-xl transition-all">
                      <div className="h-48 relative bg-gray-200">
                        <img src={evt?.image_url || 'https://via.placeholder.com/400x200'} alt={evt?.title || 'Event'} className="w-full h-full object-cover" />
                        {evt?.date && <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
                               {new Date(evt.date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric'
                })}
                            </div>}
                      </div>
                      <div className="p-6">
                         <h3 className="text-xl font-bold text-[#003D82] mb-2">{evt?.title || th('upcoming_event', 'Upcoming Event')}</h3>
                         {evt?.date && <div className="text-sm text-gray-500 mb-4 flex items-center">
                                <Calendar className="w-4 h-4 mr-2" />
                                {new Date(evt.date).toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
                             </div>}
                         <p className="text-gray-600 line-clamp-2 mb-4">{evt?.description || th('details_soon', 'Details coming soon.')}</p>

                         <Link to="/events">
                            <Button className="w-full bg-[#D4AF37] text-[#003D82] font-bold hover:bg-[#c9a227]">
                                {th('view_details', 'View Details')}
                            </Button>
                         </Link>
                      </div>
                   </motion.div>)}
             </div>
           </div>
        </section>}

      {/* Services Overview Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#003D82] mb-4">{th('our_services', 'Our Services')}</h2>
            <p className="text-xl text-gray-600">{th('our_services_subtitle', 'Comprehensive technology solutions for your needs')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => <motion.div key={index} initial={{
            opacity: 0,
            y: 20
          }} whileInView={{
            opacity: 1,
            y: 0
          }} viewport={{
            once: true
          }} transition={{
            duration: 0.5,
            delay: index * 0.1
          }} className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 border border-gray-100">
                <div className="text-[#0066CC] mb-4">{service.icon}</div>
                <h3 className="text-2xl font-semibold text-[#003D82] mb-3">{service.title}</h3>
                <p className="text-gray-700">{service.description}</p>
              </motion.div>)}
          </div>
        </div>
      </section>

      {/* Why Alpha Bridge Section */}
      <section className="py-16 bg-[#003D82]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">{th('why_alpha_bridge', 'Why Alpha Bridge?')}</h2>
            <p className="text-xl text-gray-300">{th('why_alpha_bridge_subtitle', 'Excellence in every solution we deliver')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {whyChooseUs.map((feature, index) => <motion.div key={index} initial={{
            opacity: 0,
            scale: 0.9
          }} whileInView={{
            opacity: 1,
            scale: 1
          }} viewport={{
            once: true
          }} transition={{
            duration: 0.5,
            delay: index * 0.1
          }} className="bg-white/10 backdrop-blur-md rounded-xl p-6 text-center hover:bg-white/20 transition-all duration-300 border border-white/5">
                <div className="text-[#D4AF37] mb-4 flex justify-center">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-300 text-sm">{feature.description}</p>
              </motion.div>)}
          </div>
        </div>
      </section>

      {/* Industries Served Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#003D82] mb-4">{th('industries_we_serve', 'Industries We Serve')}</h2>
            <p className="text-xl text-gray-600">{th('industries_subtitle', 'Trusted by diverse organizations across Africa and the World')}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {industries.map((industry, index) => <motion.div key={index} initial={{
            opacity: 0,
            y: 20
          }} whileInView={{
            opacity: 1,
            y: 0
          }} viewport={{
            once: true
          }} transition={{
            duration: 0.5,
            delay: index * 0.1
          }} className="bg-white rounded-xl shadow-md p-6 text-center border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="text-[#0066CC] mb-3 flex justify-center">{industry.icon}</div>
                <h3 className="text-lg font-semibold text-[#003D82]">{industry.name}</h3>
              </motion.div>)}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#003D82] mb-4">{th('testimonials_title', 'What Our Clients Say')}</h2>
            <p className="text-xl text-gray-600">{th('testimonials_subtitle', 'Trusted by businesses and organizations across Kigali')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => <motion.div key={index} initial={{
            opacity: 0,
            y: 20
          }} whileInView={{
            opacity: 1,
            y: 0
          }} viewport={{
            once: true
          }} transition={{
            duration: 0.5,
            delay: index * 0.1
          }} className="bg-white rounded-xl shadow-md p-8 border border-gray-200">
                <p className="text-gray-700 italic mb-6">"{testimonial.content}"</p>
                <div>
                  <p className="font-semibold text-[#003D82]">{testimonial.name}</p>
                  <p className="text-sm text-gray-500">{testimonial.role}</p>
                </div>
              </motion.div>)}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 bg-gradient-to-r from-[#003D82] via-[#0066CC] to-[#003D82]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">{th('cta_title', 'Ready to Get Started?')}</h2>
          <p className="text-xl text-gray-200 mb-8">
            {th('cta_subtitle', 'Contact us today for a consultation and let us bridge your technology needs.')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <WhatsAppButton className="px-8 py-6 text-lg rounded-lg shadow-xl hover:shadow-2xl" />
            
            <a href="mailto:info@alpha-bridge.net">
              <Button className="bg-white text-[#003D82] hover:bg-gray-100 px-8 py-6 text-lg rounded-lg shadow-xl hover:shadow-2xl font-semibold">
                <Mail className="w-5 h-5 mr-2" />
                {th('email_us', 'Email Us')}
              </Button>
            </a>
          </div>
        </div>
      </section>
    </>;
}
export default HomePage;