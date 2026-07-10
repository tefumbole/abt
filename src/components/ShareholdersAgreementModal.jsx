import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const AgreementSection = ({ title, children }) => (
  <div className="mb-6 last:mb-0">
    <h3 className="text-lg font-bold text-[#003366] mb-2">{title}</h3>
    <div className="text-gray-600 text-sm leading-relaxed space-y-2">
      {children}
    </div>
  </div>
);

const ShareholdersAgreementModal = ({ isOpen, onClose, onAccept }) => {
  const [hasRead, setHasRead] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) setHasRead(false);
  }, [isOpen]);

  const handleAccept = () => {
    if (hasRead) {
      onAccept();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-[#003366] to-[#004488] text-white">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-[#D4AF37]" />
                <div>
                  <h2 className="text-xl font-bold">Shareholders Agreement</h2>
                  <p className="text-xs text-blue-200">Alpha Bridge</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto p-6 md:p-8 space-y-6 bg-gray-50/50">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mb-6">
                 <p className="text-sm text-blue-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    Please read the following terms carefully. You must accept this agreement to proceed with your investment.
                 </p>
              </div>

              <AgreementSection title="1. About the Company">
                <p>Alpha Bridge is a private limited company registered in Rwanda. We specialize in IT consultancy, networking, security systems, and AV engineering. By investing, you are becoming a part of our growth story.</p>
              </AgreementSection>

              <AgreementSection title="2. Share Price & Investment Amount">
                <p>The value of one (1) share is currently set at <strong className="text-[#003366]">USD $500</strong>. This price is determined by the company's valuation and is subject to change based on future rounds and board approval. The minimum investment is one share.</p>
              </AgreementSection>

              <AgreementSection title="3. When Are Shares Issued?">
                <p>Shares will be officially issued and allocated to the Investor after a vesting period of <strong className="text-[#003366]">24 months (2 years)</strong> from the date of investment receipt. During this period, your investment is treated as Convertible Equity, securing your future ownership stake while the company deploys capital for growth.</p>
              </AgreementSection>

              <AgreementSection title="4. What Does Owning a Share Mean?">
                <p>Investors who purchase shares become partial owners of the company. Your ownership percentage is calculated based on the number of shares you hold relative to the total authorized shares of the company. You gain rights to information, voting, and profit sharing as outlined in the company constitution.</p>
              </AgreementSection>

              <AgreementSection title="5. Share Value & Price Appreciation">
                <p>The value of shares can fluctuate. While we aim for significant growth, the value may go up or down based on market conditions and company performance. Capital appreciation occurs when the company's valuation increases over time.</p>
              </AgreementSection>

              <AgreementSection title="6. Profit Payouts (Dividends)">
                <p>Dividends are payments made from company profits to shareholders. Note that dividends are <strong className="text-red-600">not guaranteed</strong>. They are declared only when the company is profitable and the Board of Directors recommends a distribution. In early growth stages, profits may be reinvested to fuel expansion.</p>
              </AgreementSection>

              <AgreementSection title="7. How Investors Make Money">
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Dividends:</strong> Receiving a share of annual profits when declared.</li>
                  <li><strong>Capital Appreciation:</strong> The value of your shares increasing over time.</li>
                  <li><strong>Exit Event:</strong> Selling shares during a company sale, merger, or public listing (IPO).</li>
                </ul>
              </AgreementSection>

              <AgreementSection title="8. Management & Control">
                <p>Day-to-day operations are managed by the Board of Directors and Executive Team. Shareholders execute their power by voting on critical matters such as the election of Directors, approval of financial statements, and major structural changes (mergers, acquisitions, dissolutions).</p>
              </AgreementSection>

              <AgreementSection title="9. Selling or Transferring Shares">
                <p>Shares are not freely tradable on a public stock exchange. If you wish to sell your shares:</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                   <li><strong>Right of First Refusal:</strong> Existing shareholders and the Company have the first right to buy them at fair market value.</li>
                   <li><strong>Transfer Approval:</strong> Transfers to third parties require Board approval to ensure alignment with company values.</li>
                </ul>
              </AgreementSection>

              <div className="border-t border-gray-200 my-6 pt-6">
                 <h3 className="text-lg font-bold text-green-700 mb-2 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" /> Transparency & Trust
                 </h3>
                 <p className="text-sm text-gray-600 mb-4">
                    Alpha Bridge commits to regular financial reporting, Annual General Meetings (AGM), and open communication lines for all investors.
                 </p>
                 
                 <div className="bg-gray-100 p-4 rounded-lg">
                    <h4 className="font-bold text-gray-900 text-sm mb-1">📌 Final Note to Investors</h4>
                    <p className="text-xs text-gray-500 italic">
                        Investing in a growing company carries risks, including the potential loss of capital. Past performance is not indicative of future results. By accepting this agreement, you confirm you are making an informed decision.
                    </p>
                 </div>
              </div>
            </div>

            {/* Footer / Actions */}
            <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">
              <div className="flex flex-col gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="modal-terms" 
                    checked={hasRead}
                    onCheckedChange={setHasRead}
                    className="border-[#D4AF37] data-[state=checked]:bg-[#D4AF37] data-[state=checked]:text-[#003366]"
                  />
                  <Label 
                    htmlFor="modal-terms" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    I have read and agree to the Shareholders Agreement
                  </Label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    variant="outline" 
                    onClick={onClose}
                    className="w-full border-gray-200 hover:bg-gray-50 text-gray-700"
                  >
                    Decline
                  </Button>
                  <Button 
                    onClick={handleAccept}
                    disabled={!hasRead}
                    className={`
                      w-full font-bold transition-all duration-300
                      ${hasRead 
                        ? 'bg-[#003366] hover:bg-[#002244] text-white shadow-lg' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
                    `}
                  >
                    Accept & Continue
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ShareholdersAgreementModal;