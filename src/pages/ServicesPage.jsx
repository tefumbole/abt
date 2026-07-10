import React from 'react';
import { Helmet } from 'react-helmet';
import WhatsAppButton from '@/components/WhatsAppButton';
import { motion } from 'framer-motion';

function ServicesPage() {
  const servicesData = [
    {
      id: 1,
      emoji: '🤖',
      title: 'Artificial Intelligence',
      description: 'Cutting-edge AI solutions for business automation and intelligent decision-making',
    },
    {
      id: 2,
      emoji: '☁️',
      title: 'Cloud Computing',
      description: 'Scalable cloud infrastructure and migration services for modern enterprises',
    },
    {
      id: 3,
      emoji: '🔒',
      title: 'Cyber Security',
      description: 'Comprehensive security solutions to protect your digital assets and data',
    },
    {
      id: 4,
      emoji: '💼',
      title: 'General IT Consultancy',
      description: 'Expert IT guidance and strategic consulting for digital transformation',
    },
    {
      id: 5,
      emoji: '📞',
      title: 'VoIP',
      description: 'Reliable voice over IP solutions for seamless business communication',
    },
    {
      id: 6,
      emoji: '🌐',
      title: 'Network Infrastructure Design',
      description: 'Robust network architecture and infrastructure planning for optimal performance',
    },
    {
      id: 7,
      emoji: '📹',
      title: 'CCTV and More',
      description: 'Advanced surveillance and security systems for comprehensive monitoring',
    },
  ];

  return (
    <>
      <Helmet>
        <title>Our Services | Alpha Bridge</title>
        <meta
          name="description"
          content="Comprehensive IT consultancy, AI solutions, cloud computing, cybersecurity, VoIP, network infrastructure, and CCTV services in Kigali, Rwanda. Professional technology solutions for businesses and events."
        />
      </Helmet>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-[#003D82] via-[#0066CC] to-[#003D82] py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-6xl font-bold text-white mb-6"
          >
            Our <span className="text-[#D4AF37]">Services</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-gray-200"
          >
            Comprehensive technology solutions tailored to your needs
          </motion.p>
        </div>
      </section>

      {/* Services Grid Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#003D82]">Explore Our Expertise</h2>
            <p className="text-xl text-gray-600 mt-4">From IT infrastructure to cutting-edge AI solutions, we've got you covered.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {servicesData.map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 flex flex-col"
              >
                <div className="text-6xl mb-4 flex-shrink-0">{service.emoji}</div>
                <h3 className="text-2xl font-bold text-[#003D82] mb-3">{service.title}</h3>
                <p className="text-gray-700 text-sm flex-grow mb-4">{service.description}</p>
                <WhatsAppButton text="Get a Quote" className="bg-[#003D82] hover:bg-[#002855] text-white px-6 py-3 self-start" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-[#003D82] to-[#0066CC]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-gray-200 mb-8">
            Contact us today to discuss your project requirements and receive a customized quote.
          </p>
          <div className="flex justify-center">
            <WhatsAppButton className="px-8 py-6 text-lg rounded-lg shadow-xl hover:shadow-2xl" />
          </div>
        </div>
      </section>
    </>
  );
}

export default ServicesPage;