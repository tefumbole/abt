import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ArrowRight, FileSignature, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

const AgreementAcceptanceSection = () => {
  const [isChecked, setIsChecked] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleBookShares = () => {
    if (!isChecked) return;

    toast({
      title: "Agreement Accepted",
      description: "Redirecting you to the share booking form...",
      className: "bg-green-600 text-white border-none"
    });

    // Slight delay for user to see the feedback
    setTimeout(() => {
      navigate('/shareholders');
    }, 1000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white/5 backdrop-blur-lg border border-gold/30 rounded-2xl p-8 my-12 shadow-2xl relative overflow-hidden"
    >
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gold/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto space-y-6">
        <div className="w-16 h-16 bg-gold/20 rounded-full flex items-center justify-center mb-2">
          <FileSignature className="w-8 h-8 text-gold" />
        </div>
        
        <h3 className="text-2xl font-bold text-white">Accept Terms & Invest</h3>
        <p className="text-gray-300">
          By acknowledging this agreement, you confirm your understanding of the risks and rewards associated with investing in Alpha Bridge.
        </p>

        <div className="flex items-center space-x-3 bg-white/5 p-4 rounded-lg border border-white/10 w-full justify-center transition-colors hover:bg-white/10">
          <Checkbox 
            id="terms" 
            checked={isChecked}
            onCheckedChange={setIsChecked}
            className="border-gold data-[state=checked]:bg-gold data-[state=checked]:text-navy w-5 h-5"
          />
          <Label 
            htmlFor="terms" 
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-200 cursor-pointer select-none"
          >
            I have read and agree to the Shareholders Agreement
          </Label>
        </div>

        <Button
          onClick={handleBookShares}
          disabled={!isChecked}
          className={`
            w-full sm:w-auto px-8 py-6 text-lg font-bold uppercase tracking-wider transition-all duration-300 transform
            ${isChecked 
              ? 'bg-gradient-to-r from-gold to-yellow-600 hover:from-yellow-400 hover:to-gold text-navy shadow-lg shadow-gold/20 hover:scale-105' 
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'}
          `}
        >
          <span className="flex items-center gap-2">
            {isChecked ? <CheckCircle2 className="w-5 h-5" /> : <FileSignature className="w-5 h-5" />}
            Book Shares Now
            {isChecked && <ArrowRight className="w-5 h-5 ml-1 animate-pulse" />}
          </span>
        </Button>
      </div>
    </motion.div>
  );
};

export default AgreementAcceptanceSection;