import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Info, Scale, PieChart, DollarSign, Users, RefreshCw, PenTool, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DigitalSignatureModal from '@/components/DigitalSignatureModal';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/context/AuthContext';
import { generateShareholderAgreementPDF, uploadSignature } from '@/utils/pdfGenerator';
import { getSystemSettings } from '@/services/settingsService';
import { parseLicenseSections, personalizeLicenseSection } from '@/data/defaultLicenseAgreement';
import FAQAccordion from '@/components/FAQAccordion';

const ICON_MAP = {
  Info, Scale, PieChart, DollarSign, Users, RefreshCw, ShieldCheck,
};

const SectionCard = ({ number, icon: Icon, title, children }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 md:p-8 hover:bg-white/10 transition-colors duration-300 shadow-xl"
  >
    <div className="flex items-start gap-4">
      <div className="hidden md:flex flex-shrink-0 w-12 h-12 bg-gradient-to-br from-[#D4AF37] to-yellow-600 rounded-lg items-center justify-center text-[#0a192f] font-bold text-xl shadow-lg shadow-[#D4AF37]/20">
        {number}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-4">
            <span className="md:hidden flex w-8 h-8 bg-[#D4AF37] rounded items-center justify-center text-[#0a192f] font-bold">{number}</span>
            <h3 className="text-xl md:text-2xl font-bold text-[#D4AF37] flex items-center gap-2">
                {Icon && <Icon className="w-6 h-6 text-white/80" />}
                {title}
            </h3>
        </div>
        <div className="text-gray-300 leading-relaxed space-y-4">
          {children}
        </div>
      </div>
    </div>
  </motion.div>
);

const ShareholdersAgreementPage = () => {
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shareSettings, setShareSettings] = useState(null);
  const [licenseSections, setLicenseSections] = useState([]);
  const [shareholderStatus, setShareholderStatus] = useState({ signed: false, date: null });

  useEffect(() => {
    async function fetchData() {
      const settings = await getSystemSettings();
      setShareSettings(settings);
      const sections = parseLicenseSections(settings?.license_agreement_json).map((s) =>
        personalizeLicenseSection(s, settings)
      );
      setLicenseSections(sections);

      if (user) {
        const { data } = await supabase.from('shareholders').select('agreement_signed_at').eq('email', user.email).single();
        if (data && data.agreement_signed_at) {
          setShareholderStatus({ signed: true, date: new Date(data.agreement_signed_at).toLocaleDateString() });
        }
      }
    }
    fetchData();
  }, [user]);

  const handleSignatureSave = async (dataUrl) => {
    setSaving(true);
    try {
        if (!user) {
            navigate('/member-signup');
            throw new Error("Please create an account or log in to sign.");
        }
        
        const { data: existing, error: fetchError } = await supabase.from('shareholders').select('id').eq('email', user.email).single();
        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        
        const signatureUrl = await uploadSignature(dataUrl, user.id);
        const agreement_signed_at = new Date().toISOString();

        if (existing) {
            await supabase.from('shareholders').update({ signature_image_url: signatureUrl, agreement_signed_at }).eq('id', existing.id);
        } else {
            await supabase.from('shareholders').insert([{ name: user.full_name, email: user.email, shares_assigned: 0, payment_status: 'unsigned', signature_image_url: signatureUrl, agreement_signed_at }]);
        }

        toast({ title: "Agreement Signed! 📝", description: "Redirecting to purchase portal..." });
        setIsSignatureModalOpen(false);
        setShareholderStatus({ signed: true, date: new Date(agreement_signed_at).toLocaleDateString() });
        setTimeout(() => navigate('/share-purchase'), 1500);

    } catch (error) {
        toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    } finally {
        setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a192f] text-white">
      <Helmet><title>Shareholders Agreement | Alpha Bridge</title></Helmet>

      {/* Hero Section */}
      <div className="relative pt-20 pb-12 overflow-hidden">
         <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
             Investor & Shareholder Agreement
            </h1>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* Share Info Section */}
        {shareSettings && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white">
                 <div className="bg-white/5 p-4 rounded-lg text-center">
                     <p className="text-sm text-gray-400">Total Shares</p>
                     <p className="text-2xl font-bold text-[#D4AF37]">{shareSettings.total_shares}</p>
                 </div>
                 <div className="bg-white/5 p-4 rounded-lg text-center">
                     <p className="text-sm text-gray-400">Available to Public</p>
                     <p className="text-2xl font-bold text-[#D4AF37]">{shareSettings.total_available}</p>
                 </div>
             </div>
        )}

        <div className="space-y-8">
            {licenseSections.map((section) => {
              const Icon = ICON_MAP[section.icon] || Info;
              return (
                <SectionCard key={section.number} number={section.number} icon={Icon} title={section.title}>
                  {(section.paragraphs || []).map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </SectionCard>
              );
            })}
        </div>

        <div className="flex flex-col items-center justify-center pt-12 pb-8 space-y-6">
            {shareholderStatus.signed ? (
                <div className="text-center p-6 bg-green-900/50 border border-green-500 rounded-lg">
                    <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                    <h3 className="text-xl font-bold text-white">Agreement Signed</h3>
                    <p className="text-green-300">Signed on: {shareholderStatus.date}</p>
                    <Button onClick={() => navigate('/share-purchase')} className="mt-4">Proceed to Purchase</Button>
                </div>
            ) : (
                <>
                    <h3 className="text-2xl font-bold text-[#D4AF37]">Acceptance of Terms</h3>
                    <p className="text-gray-400 text-center max-w-2xl">By signing, you agree to the terms outlined in this Shareholder Agreement.</p>
                    <Button size="lg" className="bg-[#003D82] hover:bg-[#002d62] text-white border-2 border-[#D4AF37] font-bold text-lg px-12 py-6 rounded-full" onClick={() => setIsSignatureModalOpen(true)}>
                        <PenTool className="w-5 h-5 mr-2" /> Agree and Sign
                    </Button>
                </>
            )}
        </div>

        <div className="pt-8 border-t border-white/10"><FAQAccordion /></div>
      </div>

      <DigitalSignatureModal open={isSignatureModalOpen} onOpenChange={setIsSignatureModalOpen} onSave={handleSignatureSave} loading={saving}/>
    </div>
  );
};

export default ShareholdersAgreementPage;