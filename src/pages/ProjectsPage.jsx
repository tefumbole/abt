import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { MessageCircle, ExternalLink } from 'lucide-react';
import WhatsAppButton from '@/components/WhatsAppButton';

const TikTokEmbed = ({ videoUrl, title }) => {
  // Extract video ID from URL for unique quoting
  const videoId = videoUrl.split('/video/')[1]?.split('?')[0];

  return (
    <div className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 p-4 h-full flex flex-col">
      <div className="flex-grow flex items-center justify-center bg-gray-100 rounded-lg mb-4 min-h-[500px] relative">
         <blockquote 
          className="tiktok-embed" 
          cite={videoUrl}
          data-video-id={videoId}
          style={{ maxWidth: '605px', minWidth: '325px' }}
        >
          <section>
            <a target="_blank" rel="noopener noreferrer" href={videoUrl} title={title} className="text-[#0066CC] hover:underline">
              {title}
            </a>
          </section>
        </blockquote>
      </div>
      <div className="mt-4">
        <h3 className="text-lg font-bold text-[#003D82] mb-2">{title}</h3>
        <a 
          href={videoUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm text-[#D4AF37] hover:text-[#003D82] transition-colors font-medium"
        >
          Watch on TikTok <ExternalLink className="w-4 h-4 ml-1" />
        </a>
      </div>
    </div>
  );
};

function ProjectsPage() {
  const projects = [
    {
      id: 1,
      url: "https://www.tiktok.com/@tefurolandmbole/video/7495818139272301829",
      title: "Project Highlight: Professional Installation",
      description: "A showcase of our precision engineering in action."
    },
    {
      id: 2,
      url: "https://www.tiktok.com/@tefurolandmbole/video/7493245944540974341?is_from_webapp=1&sender_device=pc&web_id=7604194064942515713",
      title: "Advanced Networking Setup",
      description: "Enterprise-grade networking solutions for scalable business growth."
    },
    {
      id: 3,
      url: "https://www.tiktok.com/@tefurolandmbole/video/7492891748327361797?is_from_webapp=1&sender_device=pc&web_id=7604194064942515713",
      title: "Audio-Visual Excellence",
      description: "Delivering crystal clear sound and stunning visuals for events."
    }
  ];

  // Load TikTok script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>Our Projects | Alpha Bridge</title>
        <meta
          name="description"
          content="Explore our recent projects in IT consultancy, networking, and audio-visual installations across Kigali, Rwanda."
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
            Our <span className="text-[#D4AF37]">Projects</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-gray-200"
          >
            See our engineering precision in action
          </motion.p>
        </div>
      </section>

      {/* Projects Grid */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <TikTokEmbed videoUrl={project.url} title={project.title} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-[#003D82] mb-6">Inspired by our work?</h2>
          <p className="text-lg text-gray-700 mb-8">
            Let's discuss how we can bring the same level of quality to your next project.
          </p>
          <div className="flex justify-center">
            <WhatsAppButton text="Start Your Project" className="px-8 py-6 text-lg" />
          </div>
        </div>
      </section>
    </>
  );
}

export default ProjectsPage;