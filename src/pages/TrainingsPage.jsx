import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, ChevronDown, ChevronUp, ArrowRight,
  Brain, Cloud, Shield, Briefcase, Phone, Network, Video
} from 'lucide-react';
import WhatsAppButton from '@/components/WhatsAppButton';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { getTrainingPrograms } from '@/services/coursesService';
import { trainingModules } from '@/utils/trainingCourseUtils';
import { usePageT } from '@/hooks/useSiteLabel';
import { useSiteLabel } from '@/hooks/useSiteLabel';
import { useSiteContent } from '@/hooks/useSiteContent';

const iconMap = {
  Brain, Cloud, Shield, Briefcase, Phone, Network, Video
};

function TrainingsPage() {
  const tt = usePageT('training');
  const tl = useSiteLabel();
  const { field } = useSiteContent();
  const [expandedModule, setExpandedModule] = useState(null);
  const [programs, setPrograms] = useState(trainingModules);
  const navigate = useNavigate();
  const heroTitle = field(
    'trainings',
    'hero_title',
    `Professional <span class="text-[#D4AF37]">IT Training</span>`
  );
  const heroSubtitle = field(
    'trainings',
    'hero_subtitle',
    tt('hero_subtitle', 'Master cutting-edge technologies with industry-leading programs')
  );

  useEffect(() => {
    getTrainingPrograms()
      .then(setPrograms)
      .catch(() => setPrograms(trainingModules));
  }, []);

  const toggleModule = (id) => {
    setExpandedModule(expandedModule === id ? null : id);
  };

  const handleRegister = (moduleName, e) => {
    e.stopPropagation();
    navigate(`/registration?module=${encodeURIComponent(moduleName)}`);
  };

  return (
    <>
      <Helmet>
        <title>Professional IT Training Programs 2026 | Alpha Bridge</title>
        <meta
          name="description"
          content="Advanced technical training in AI, Cloud Computing, Cybersecurity, IT Consultancy, VoIP, Network Infrastructure, and CCTV Systems. Professional hands-on learning in Kigali, Rwanda."
        />
      </Helmet>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#003D82] via-[#0052A3] to-[#003D82] pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1
              className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6"
              dangerouslySetInnerHTML={{ __html: heroTitle }}
            />
            <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-4xl mx-auto">
              {heroSubtitle}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <Button 
                className="bg-[#D4AF37] hover:bg-[#C19B2A] text-[#003D82] px-8 py-6 text-lg font-bold shadow-lg hover:scale-105 transition-transform rounded-full"
                onClick={() => document.getElementById('programs').scrollIntoView({ behavior: 'smooth' })}
              >
                {tt('explore_programs', 'Explore Programs')}
              </Button>
              <Link to="/registration">
                <Button 
                  variant="outline"
                  className="border-2 border-white text-white hover:bg-white hover:text-[#003D82] px-8 py-6 text-lg font-bold shadow-lg hover:scale-105 transition-all rounded-full"
                >
                  {tt('register_now', 'Register Now')}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-[#003D82] mb-2">{programs.length}</div>
              <div className="text-gray-600">{tt('training_programs', 'Training Programs')}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#003D82] mb-2">8-14</div>
              <div className="text-gray-600">{tt('weeks_duration', 'Weeks Duration')}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#003D82] mb-2">100%</div>
              <div className="text-gray-600">{tl('training', 'Hands-on Labs')}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#003D82] mb-2">24/7</div>
              <div className="text-gray-600">{tl('training', 'Support Access')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Programs Section */}
      <section id="programs" className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[#003D82] mb-4">
              {field('trainings', 'heading', tt('programs_title', 'Training Programs'))}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {field(
                'trainings',
                'subheading',
                tl('training', 'Select a program to explore the comprehensive curriculum, tools, and career opportunities')
              )}
            </p>
          </div>

          <div className="space-y-6">
            {programs.map((module, index) => {
              const IconComponent = iconMap[module.icon];
              
              return (
                <motion.div
                  key={module.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-xl transition-shadow"
                >
                  <button
                    onClick={() => toggleModule(module.id)}
                    className="w-full px-6 md:px-8 py-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-4 md:space-x-6 flex-1">
                      <div 
                        className="p-4 rounded-xl flex-shrink-0"
                        style={{ backgroundColor: `${module.color}15` }}
                      >
                        {IconComponent && (
                          <IconComponent 
                            className="w-8 h-8 md:w-10 md:h-10" 
                            style={{ color: module.color }}
                          />
                        )}
                      </div>
                      <div className="text-left flex-1">
                        <h3 className="text-xl md:text-2xl font-bold text-[#003D82] mb-1">
                          {module.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <span className="font-semibold">{module.duration}</span>
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline">{module.deliveryMode}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      {expandedModule === module.id ? (
                        <ChevronUp className="w-6 h-6 md:w-7 md:h-7 text-[#D4AF37]" />
                      ) : (
                        <ChevronDown className="w-6 h-6 md:w-7 md:h-7 text-gray-400" />
                      )}
                    </div>
                  </button>

                  <AnimatePresence>
                    {expandedModule === module.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-gray-200"
                      >
                        <div className="px-6 md:px-8 py-8 bg-gradient-to-b from-gray-50 to-white">
                          {/* Curriculum Sections */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {(module.sections || []).map((section, sectionIdx) => (
                              <div 
                                key={sectionIdx}
                                className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                              >
                                <h4 className="text-lg font-bold text-[#003D82] mb-4 flex items-center gap-2">
                                  <span 
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: module.color }}
                                  ></span>
                                  {section.title}
                                </h4>
                                <ul className="space-y-2.5">
                                  {section.items.map((item, itemIdx) => (
                                    <li 
                                      key={itemIdx}
                                      className="flex items-start gap-3 text-gray-700 text-sm"
                                    >
                                      <CheckCircle2 
                                        className="w-4 h-4 mt-0.5 flex-shrink-0" 
                                        style={{ color: module.color }}
                                      />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-6 border-t border-gray-200">
                            <div className="text-sm text-gray-600">
                              <span className="font-semibold">Duration:</span> {module.duration} | 
                              <span className="font-semibold ml-2">Mode:</span> {module.deliveryMode}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                              <WhatsAppButton 
                                text={`Inquire about ${module.title}`}
                                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold"
                              />
                              <Button 
                                className="text-white px-6 py-3 rounded-lg font-semibold hover:scale-105 transition-transform"
                                style={{ backgroundColor: module.color }}
                                onClick={(e) => handleRegister(module.title, e)}
                              >
                                Register for {module.title} <ArrowRight className="w-4 h-4 ml-2" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#003D82] mb-4">Why Train With Us?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <div className="w-16 h-16 bg-[#003D82] rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-[#003D82] mb-2">Industry Experts</h3>
              <p className="text-gray-600">Learn from certified professionals with real-world experience</p>
            </div>
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <div className="w-16 h-16 bg-[#003D82] rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-[#003D82] mb-2">Hands-On Labs</h3>
              <p className="text-gray-600">Practical training with real equipment and enterprise tools</p>
            </div>
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <div className="w-16 h-16 bg-[#003D82] rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-[#003D82] mb-2">Career Support</h3>
              <p className="text-gray-600">Job placement assistance and certification preparation</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-[#003D82] via-[#0052A3] to-[#003D82] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Career?
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Join thousands of professionals who have upgraded their skills with Alpha Bridge
          </p>
          
          <div className="flex flex-col items-center space-y-6">
            <Link to="/registration">
              <Button 
                className="bg-[#D4AF37] text-[#003D82] hover:bg-[#C19B2A] px-12 py-6 text-xl font-bold rounded-full shadow-2xl hover:scale-110 transition-transform h-auto" 
              >
                Enroll Now — Limited Seats Available
              </Button>
            </Link>
            
            <div className="flex flex-col sm:flex-row items-center gap-6 mt-8 text-blue-200 text-sm">
              <a href="mailto:info@alpha-bridge.net" className="hover:text-[#D4AF37] transition-colors">
                info@alpha-bridge.net
              </a>
              <span className="hidden sm:inline text-blue-400">•</span>
              <a href="tel:+250794006160" className="hover:text-[#D4AF37] transition-colors">
                +250 794 006 160
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default TrainingsPage;