import React, { useRef, useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Info, Scale, PieChart, DollarSign, Users, RefreshCw, XCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getSharePrice, formatPrice, getSystemSettings } from '@/services/sharePriceService';

const SectionCard = ({ number, icon: Icon, title, children }) => (
  <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6 hover:bg-white/10 transition-colors duration-300">
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 w-10 h-10 bg-[#D4AF37]/20 rounded-lg flex items-center justify-center text-[#D4AF37] font-bold text-lg border border-[#D4AF37]/30">
        {number}
      </div>
      <div className="flex-1">
        <h3 className="text-lg md:text-xl font-bold text-[#D4AF37] mb-3 flex items-center gap-2">
            {Icon && <Icon className="w-5 h-5 text-gray-300" />}
            {title}
        </h3>
        <div className="text-gray-300 leading-relaxed text-sm md:text-base space-y-3">
          {children}
        </div>
      </div>
    </div>
  </div>
);

const ShareholdersPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const contentRef = useRef(null);

  const [priceLoading, setPriceLoading] = useState(true);
  const [agreeing, setAgreeing] = useState(false);
  const [sharePrice, setSharePrice] = useState(1000);
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    let cancelled = false;

    const fetchSharePrice = async () => {
      setPriceLoading(true);
      try {
        const settings = await getSystemSettings();
        if (!cancelled) {
          setSharePrice(settings.price_per_share);
          setCurrency(settings.currency);
        }
      } catch (err) {
        console.error('Error loading share price:', err);
      } finally {
        if (!cancelled) setPriceLoading(false);
      }
    };

    fetchSharePrice();
    return () => { cancelled = true; };
  }, []);

  const handleAgree = () => {
    if (agreeing) return;
    setAgreeing(true);
    localStorage.setItem('shareholderAgreementAccepted', 'true');
    toast({
      title: 'Agreement Accepted',
      description: 'Redirecting to shares portal...',
      className: 'bg-green-600 text-white border-none',
    });
    setTimeout(() => {
      navigate('/shares');
    }, 600);
  };

  const handleDisagree = () => {
    toast({
      title: "Agreement Required",
      description: "You must agree to the terms to view available shares and investment opportunities.",
      variant: "destructive",
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[--primary-blue] text-white flex flex-col">
      <Helmet>
        <title>Shareholders Agreement | Alpha Bridge</title>
        <meta name="description" content="Read and accept the Shareholder Agreement to invest in Alpha Bridge." />
      </Helmet>

      {/* Header */}
      <div className="bg-[#002855] border-b border-[#D4AF37]/30 py-8 sticky top-[80px] z-30 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 text-center">
           <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center justify-center gap-3">
             <ShieldCheck className="w-8 h-8 text-[#D4AF37]" />
             Shareholder Agreement
           </h1>
           <p className="text-gray-300 mt-2 text-sm">Please read the following terms carefully before proceeding.</p>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="bg-[#002244] rounded-2xl p-6 md:p-10 border border-[#D4AF37]/20 shadow-2xl overflow-y-auto max-h-[65vh] scrollbar-thin scrollbar-thumb-[#D4AF37] scrollbar-track-transparent">
            
            {/* Intro */}
            <div className="mb-8 p-6 bg-blue-900/30 rounded-lg border-l-4 border-[#D4AF37]">
                <h2 className="text-xl font-bold text-white mb-2">Terms & Conditions of Investment</h2>
                <p className="text-gray-300">
                    This document serves as a binding understanding between Alpha Bridge (the "Company") and you (the "Investor"). 
                    By clicking "I Agree" below, you acknowledge that you have read, understood, and accepted these terms.
                </p>
            </div>

            <SectionCard number="1" icon={Info} title="About the Company">
                <p>
                    <strong>Alpha Bridge</strong> is a private limited company registered in Rwanda. 
                    We specialize in IT consultancy, networking, security systems, and AV engineering.
                </p>
            </SectionCard>

            <SectionCard number="2" icon={DollarSign} title="Share Price">
                {priceLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading current price...</span>
                  </div>
                ) : (
                  <p>
                    The value of one (1) share is currently set at <strong className="text-[#D4AF37]">{formatPrice(sharePrice, currency)}</strong>. 
                    This price is subject to change based on future valuations and board approval.
                  </p>
                )}
            </SectionCard>

            <SectionCard number="3" icon={PieChart} title="Share Issuance">
                <ul className="list-disc pl-5 space-y-2 marker:text-[#D4AF37]">
                    <li>Shares will be officially issued and allocated to the Investor after a vesting period of <strong className="text-white">24 months (2 years)</strong> from the date of investment receipt.</li>
                    <li>During this 24-month period, your investment is treated as <em>Convertible Equity</em>—securing your future ownership stake.</li>
                </ul>
            </SectionCard>

            <SectionCard number="4" icon={Users} title="Share Ownership">
                <p>
                    Investors who purchase shares become partial owners of the company. 
                    Ownership percentage is calculated based on the number of shares held relative to the total authorized shares of the company.
                </p>
            </SectionCard>

            <SectionCard number="5" icon={Scale} title="Share Value">
                <p>
                    The value of shares can fluctuate. While we aim for growth, the value may go up or down based on market conditions and company performance.
                </p>
            </SectionCard>

            <SectionCard number="6" icon={DollarSign} title="Dividends (Profit Sharing)">
                <ul className="list-disc pl-5 space-y-2 marker:text-[#D4AF37]">
                    <li>Dividends are payments made from company profits to shareholders.</li>
                    <li>Dividends are <strong>not guaranteed</strong>. They are declared only when the company is profitable and the Board of Directors recommends a distribution.</li>
                    <li>Reinvestment for growth may sometimes take priority over immediate dividend payouts.</li>
                </ul>
            </SectionCard>

            <SectionCard number="7" icon={Users} title="Management & Voting">
                <p>
                    Day-to-day operations are managed by the Board of Directors and Executive Team. 
                    Shareholders execute their power by voting on critical matters such as:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1 marker:text-[#D4AF37] text-sm">
                    <li>Election of Directors</li>
                    <li>Approval of financial statements</li>
                    <li>Mergers, acquisitions, or sale of assets</li>
                    <li>Changes to the company constitution</li>
                </ul>
            </SectionCard>

            <SectionCard number="8" icon={RefreshCw} title="Share Transfer & Exit">
                <p>
                    Shares are not freely tradable on a public stock exchange.
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-2 marker:text-[#D4AF37]">
                    <li><strong className="text-white">Right of First Refusal:</strong> If you wish to sell your shares, existing shareholders and the Company have the first right to buy them at fair market value.</li>
                    <li><strong className="text-white">Transfer Approval:</strong> Transfers to third parties require Board approval to ensure alignment with company values.</li>
                </ul>
            </SectionCard>
            
            <div className="mt-8 p-6 bg-red-900/20 rounded-lg border border-red-500/30">
                <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                    <XCircle className="w-5 h-5" /> Risk Disclosure
                </h3>
                <p className="text-gray-300 text-sm">
                    Investing in startups and growing companies involves risk, including potential loss of capital. 
                    Past performance does not guarantee future results.
                </p>
            </div>
        </div>
      </div>

      {/* Footer Actions — keep above site footer and WhatsApp widget */}
      <div className="bg-[#002855] border-t border-[#D4AF37]/30 py-6 sticky bottom-0 z-[55] shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
        <div className="max-w-4xl mx-auto px-4 pr-24 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400 text-center sm:text-left">
                Do you accept the terms outlined in the Shareholders Agreement?
            </p>
            <div className="flex gap-4 w-full sm:w-auto">
                <Button 
                    type="button"
                    onClick={handleDisagree}
                    variant="outline"
                    className="flex-1 sm:flex-none border-red-500/50 text-red-400 hover:bg-red-950/30 hover:text-red-300"
                >
                    I Disagree
                </Button>
                <Button 
                    type="button"
                    onClick={handleAgree}
                    disabled={agreeing}
                    className="flex-1 sm:flex-none !bg-[#D4AF37] !text-[#003D82] hover:!bg-[#b5952f] disabled:!opacity-70 font-bold px-8 shadow-lg shadow-[#D4AF37]/20 border border-[#D4AF37]/40"
                >
                    {agreeing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    I Agree
                </Button>
            </div>
        </div>
      </div>

    </div>
  );
};

export default ShareholdersPage;