import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';

const FAQAccordion = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: "What is the minimum investment to become a shareholder?",
      answer: "The minimum investment is 1 share at USD $500. You can invest more, subject to company approval."
    },
    {
      question: "When will I receive my shares?",
      answer: "Shares are issued after 24 months (2 years) from your investment date. Until then, your money is treated as convertible equity."
    },
    {
      question: "Can I sell my shares anytime?",
      answer: "Shares cannot be freely sold to outsiders. Existing shareholders and the company have first priority to buy your shares at fair market value."
    },
    {
      question: "How much profit will I make?",
      answer: "Returns depend on company performance. You can earn through: (1) Dividends when profitable, (2) Share price appreciation as the company grows, (3) Exit events like company sale or listing."
    },
    {
      question: "Are dividends guaranteed?",
      answer: "No, dividends are not guaranteed. They are only paid if the company makes profit and the Board recommends a dividend that shareholders approve."
    },
    {
      question: "What voting rights do I have?",
      answer: "As a shareholder, you can vote on major decisions including issuing new shares, large loans, sale of major assets, mergers, or dissolution."
    },
    {
      question: "What if the company is sold?",
      answer: "If the company is sold or acquired, shareholders receive proceeds based on their ownership percentage."
    },
    {
      question: "How often are financial reports shared?",
      answer: "Alpha Bridge commits to annual financial reviews and regular shareholder communication for transparency."
    },
    {
      question: "Can I transfer my shares to someone else?",
      answer: "Shares can be transferred, but existing shareholders and the company have first priority to purchase them before external transfer."
    },
    {
      question: "What happens if I want to exit my investment?",
      answer: "You can request the company to buy back your shares at fair market value, or sell to existing shareholders with company approval."
    }
  ];

  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100 border border-blue-200 text-blue-800 text-sm font-semibold mb-4">
          <HelpCircle className="w-4 h-4" /> FAQ
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-navy">
          Frequently Asked Questions for Shareholders
        </h2>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <motion.div 
            key={index}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.05 }}
            className={`
              rounded-xl overflow-hidden border transition-all duration-300
              ${openIndex === index 
                ? 'bg-white border-gold shadow-lg ring-1 ring-gold/20' 
                : 'bg-white/80 border-gray-200 hover:border-gold/50 hover:bg-white'}
            `}
          >
            <button
              onClick={() => toggleAccordion(index)}
              className="w-full flex items-center justify-between p-5 text-left focus:outline-none"
            >
              <span className={`text-lg font-semibold ${openIndex === index ? 'text-navy' : 'text-gray-700'}`}>
                {faq.question}
              </span>
              <ChevronDown 
                className={`w-5 h-5 text-gold transition-transform duration-300 ${openIndex === index ? 'transform rotate-180' : ''}`}
              />
            </button>
            
            <AnimatePresence>
              {openIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  <div className="px-5 pb-5 text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                    {faq.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default FAQAccordion;