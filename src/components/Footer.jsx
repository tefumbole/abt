import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, Globe } from 'lucide-react';
import WhatsAppButton from '@/components/WhatsAppButton';
import BrandLogo from '@/components/BrandLogo';
import { getSystemSettings } from '@/services/settingsService';
import { useSiteLabel } from '@/hooks/useSiteLabel';
import { usePageT } from '@/hooks/useSiteLabel';
import { CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, WEBSITE_HOST, WHATSAPP_PHONE, COMPANY_NAME, COMPANY_NAME_SHORT } from '@/constants/branding';

function Footer() {
  const tl = useSiteLabel();
  const tf = usePageT('footer');
  const currentYear = new Date().getFullYear();
  const [settings, setSettings] = useState({
      developed_by: COMPANY_NAME,
      copyright_text: 'All rights reserved',
      logo_url: null
  });

  useEffect(() => {
    const fetchSettings = async () => {
        try {
            const data = await getSystemSettings();
            if (data) {
                setSettings(prev => ({
                    ...prev,
                    developed_by: data.developed_by || prev.developed_by,
                    copyright_text: data.copyright_text || prev.copyright_text,
                    logo_url: data.logo_url
                }));
            }
        } catch (error) {
            console.warn("Footer: using default settings");
        }
    };
    fetchSettings();
  }, []);

  const quickLinks = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
    { name: 'Training', path: '/trainings' },
    { name: 'Gallery', path: '/gallery' },
    { name: 'Contact', path: '/contact' },
    { name: 'Shareholders Portal', path: '/shareholders' },
  ];

  return (
    <footer className="bg-[#1a1a2e] text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="mb-4">
              <Link to="/" className="inline-block mb-2 bg-transparent">
                <BrandLogo
                  alt={COMPANY_NAME}
                  className="h-[50px] w-auto object-contain hover:scale-105 transition-all duration-300"
                  variant="onDark"
                  src={settings.logo_url || undefined}
                  preferSystemLogo={!settings.logo_url}
                />
              </Link>
              <div className="text-2xl font-bold">
                <span className="text-[#D4AF37]">{COMPANY_NAME_SHORT}</span>
              </div>
            </div>
            <p className="text-gray-300 text-sm mb-4">
              {tf('tagline', 'Your Technology Bridge to Kigali. Professional IT, networking, security, and audio-visual solutions.')}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-[#D4AF37] mb-4">{tf('quick_links', 'Quick Links')}</h3>
            <nav className="flex flex-col space-y-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="text-gray-300 hover:text-[#D4AF37] transition-colors text-sm"
                >
                  {tl('footer', link.name)}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-[#D4AF37] mb-4">{tf('contact_us', 'Contact Us')}</h3>
            <div className="space-y-3">
              <div className="mb-4">
                 <WhatsAppButton 
                    text={tf('chat_now', 'Chat now')} 
                    className="w-full sm:w-auto bg-[#25D366] hover:bg-[#1EBE57]"
                 />
              </div>
              <a
                href={`tel:${WHATSAPP_PHONE}`}
                className="flex items-center space-x-3 text-gray-300 hover:text-[#D4AF37] transition-colors text-sm"
              >
                <Phone className="w-5 h-5 flex-shrink-0" />
                <span>{CONTACT_PHONE_DISPLAY}</span>
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center space-x-3 text-gray-300 hover:text-[#D4AF37] transition-colors text-sm"
              >
                <Mail className="w-5 h-5 flex-shrink-0" />
                <span>{CONTACT_EMAIL}</span>
              </a>
              <a
                href={`https://${WEBSITE_HOST}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-3 text-gray-300 hover:text-[#D4AF37] transition-colors text-sm"
              >
                <Globe className="w-5 h-5 flex-shrink-0" />
                <span>{WEBSITE_HOST}</span>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-700 text-center">
          <p className="text-gray-400 text-sm">
            © {currentYear} {settings.copyright_text === 'All rights reserved'
              ? tf('all_rights_reserved', settings.copyright_text)
              : settings.copyright_text}
          </p>
          <p className="text-gray-500 text-xs mt-2">
             {tf('developed_by', 'Developed by')} <span className="text-gray-400 font-medium">{settings.developed_by}</span>
          </p>
          <p className="text-gray-600 text-[10px] mt-1">
             {tf('location', 'Kigali, Rwanda')}
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
