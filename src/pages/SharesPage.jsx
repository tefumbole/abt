import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import ShareholdersRegistrationForm from '@/components/ShareholdersRegistrationForm';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Shield, TrendingUp, Users, Unlock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getSharePrice, formatPrice, getSystemSettings } from '@/services/sharePriceService';

const SharesPage = () => {
  const [loading, setLoading] = useState(true);
  const [sharePrice, setSharePrice] = useState(1000);
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    const fetchSharePrice = async () => {
      setLoading(true);
      try {
        const settings = await getSystemSettings();
        setSharePrice(settings.price_per_share);
        setCurrency(settings.currency);
      } catch (err) {
        console.error('Error loading share price:', err);
        // Use defaults
      } finally {
        setLoading(false);
      }
    };

    fetchSharePrice();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Helmet>
        <title>Invest in Shares | Alpha Bridge</title>
        <meta name="description" content="Secure your shares in Alpha Bridge. Join our community of shareholders and be part of our growth story." />
      </Helmet>

      {/* Hero Section */}
      <section className="bg-[#003D82] text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80')] bg-cover bg-center opacity-10"></div>
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-blue-500/30 backdrop-blur-md px-4 py-1.5 rounded-full text-blue-100 text-sm font-medium mb-6 border border-blue-400/30"
          >
            <Unlock className="h-3.5 w-3.5" />
            Public Offering - No Login Required
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
          >
            Invest in the Future
          </motion.h1>
          <motion.p 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.2 }}
             className="text-xl md:text-2xl text-blue-100 max-w-2xl mx-auto"
          >
            Join our community of shareholders and be part of our growth story. Secure your shares instantly.
          </motion.p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12 -mt-10 relative z-20">
        <div className="grid lg:grid-cols-3 gap-8 items-start">
          
          {/* Info Section - Left Column */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-none shadow-xl bg-white/95 backdrop-blur">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3 text-[#003D82] font-bold text-lg mb-2">
                  <Shield className="h-6 w-6" />
                  Why Invest?
                </div>
                <ul className="space-y-3">
                  {[
                    "Proven Track Record of Growth",
                    "Transparent Financial Reporting",
                    "Quarterly Dividend Payouts",
                    "Voting Rights at AGM"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-600">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-blue-600 text-white">
              <CardContent className="p-6">
                <h4 className="font-bold text-lg mb-2 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Share Value
                </h4>
                {loading ? (
                  <div className="flex items-center gap-2 my-3">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-lg">Loading price...</span>
                  </div>
                ) : (
                  <>
                    <div className="text-3xl font-extrabold mb-1">{formatPrice(sharePrice, currency)}</div>
                    <p className="text-blue-100 text-sm">Current price per share unit. Minimum purchase is 1 share.</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gray-900 text-white">
              <CardContent className="p-6">
                <h4 className="font-bold text-lg mb-2 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Community
                </h4>
                <p className="text-gray-300 text-sm">
                  Join over 1,500 investors who have already partnered with us to build sustainable technology solutions across Africa.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Form Section - Main Column */}
          <div className="lg:col-span-2">
             <ShareholdersRegistrationForm />
          </div>

        </div>
      </div>
    </div>
  );
};

export default SharesPage;