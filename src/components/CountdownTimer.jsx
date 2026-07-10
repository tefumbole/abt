import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTimeRemaining } from '@/services/countdownService';
import { Rocket, Clock } from 'lucide-react';

const TimeUnit = ({ value, label }) => (
  <div className="flex flex-col items-center mx-1 md:mx-2 lg:mx-3">
    <div className="relative group">
      <motion.div
        key={value}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="w-14 h-14 md:w-20 md:h-20 lg:w-24 lg:h-24 flex items-center justify-center bg-gradient-to-br from-[#003D82] to-[#0a192f] rounded-lg shadow-lg border border-[#D4AF37]/30 transition-all duration-300 transform hover:scale-105"
      >
        <span className="text-xl md:text-3xl lg:text-4xl font-bold text-[#D4AF37] tabular-nums drop-shadow-md">
          {value < 10 ? `0${value}` : value}
        </span>
      </motion.div>
      <div className="absolute inset-0 bg-[#D4AF37] opacity-0 group-hover:opacity-10 blur-xl rounded-xl transition-opacity duration-300 -z-10"></div>
    </div>
    <span className="mt-2 text-xs md:text-sm font-semibold text-gray-200 uppercase tracking-widest">{label}</span>
  </div>
);

const Separator = () => (
  <div className="hidden md:flex flex-col justify-center h-14 md:h-20 lg:h-24 pb-6">
    <div className="flex gap-1 text-[#D4AF37] text-2xl font-light">:</div>
  </div>
);

const CountdownTimer = ({ className = "" }) => {
  const [timeLeft, setTimeLeft] = useState(getTimeRemaining());
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const timer = setInterval(() => {
      setTimeLeft(getTimeRemaining());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!isClient) return null;

  return (
    <div className={`w-full max-w-4xl mx-auto py-4 ${className}`}>
      
      <div className="text-center mb-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#D4AF37]/20 text-white font-semibold text-sm mb-3 border border-[#D4AF37]/30"
        >
          <Clock className="w-4 h-4 text-[#D4AF37]" /> Official Countdown
        </motion.div>
        
        <h3 className="text-xl md:text-2xl font-bold text-white flex items-center justify-center gap-3">
          <Rocket className="w-5 h-5 md:w-6 md:h-6 text-[#D4AF37]" />
          Alpha Bridge Grand Launch
        </h3>
        <p className="text-gray-300 mt-1 font-medium text-sm">April 5th, 2026 • 11:00 AM</p>
      </div>

      <div className="flex flex-wrap justify-center items-start md:gap-2">
        <TimeUnit value={timeLeft.days} label="Days" />
        <Separator />
        <TimeUnit value={timeLeft.hours} label="Hours" />
        <Separator />
        <TimeUnit value={timeLeft.minutes} label="Minutes" />
        <Separator />
        <TimeUnit value={timeLeft.seconds} label="Seconds" />
      </div>

      {timeLeft.isExpired && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="mt-6 text-center"
        >
          <div className="inline-block px-6 py-3 bg-[#D4AF37] text-[#003D82] text-lg font-bold rounded-lg shadow-lg animate-bounce">
            🚀 We Have Launched!
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default CountdownTimer;