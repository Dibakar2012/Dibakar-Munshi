import React, { useState } from 'react';
import { CreditCard, Zap, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PremiumRequestModal from './PremiumRequestModal';
import { auth } from '../lib/firebase';

interface PaywallProps {
  onClose?: () => void;
}

export default function Paywall({ onClose }: PaywallProps) {
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const userEmail = auth.currentUser?.email;

  const handlePay = () => {
    setIsRequestModalOpen(true);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-start justify-center relative custom-scrollbar">
      {onClose && (
        <button 
          onClick={onClose}
          className="fixed top-20 right-6 p-2 bg-surface/80 backdrop-blur-md border border-border hover:bg-surface-hover rounded-full transition-colors z-20"
        >
          <X size={20} />
        </button>
      )}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-[92%] bg-surface border border-border rounded-3xl p-6 md:p-10 text-center shadow-2xl my-auto"
      >
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Zap className="text-primary" size={24} />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">Subscription Required</h2>
        <p className="text-sm text-text-muted mb-8 max-w-md mx-auto">
          You've used all your free credits. Upgrade to a premium plan to continue using Dibakar AI.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-background border border-border p-5 rounded-2xl text-left hover:border-primary transition-all group relative overflow-hidden">
            <h3 className="text-lg font-bold mb-1">Starter Plan</h3>
            <div className="text-2xl font-bold mb-3">₹35</div>
            <ul className="space-y-2 text-xs text-text-muted mb-6">
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-primary" /> 70 Total Requests</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-primary" /> 30-Day Validity</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-primary" /> Standard Support</li>
            </ul>
            <button
              onClick={handlePay}
              className="w-full bg-surface-hover border border-border group-hover:bg-primary group-hover:text-white py-2.5 rounded-xl font-bold text-sm transition-all"
            >
              Pay Now
            </button>
          </div>

          <div className="bg-background border-2 border-primary p-5 rounded-2xl text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-white text-[8px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-widest">
              Best Value
            </div>
            <h3 className="text-lg font-bold mb-1">Pro Plan</h3>
            <div className="text-2xl font-bold mb-3">₹99</div>
            <ul className="space-y-2 text-xs text-text-muted mb-6">
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-primary" /> 300 Total Requests</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-primary" /> 20 Daily Limit</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-primary" /> Priority Support</li>
            </ul>
            <button
              onClick={handlePay}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-lg shadow-primary/20"
            >
              Pay Now
            </button>
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl">
          <p className="text-[10px] md:text-xs text-text-muted leading-relaxed">
            Once payment is confirmed, an admin will manually inject credits into your account. Contact support if you have any questions.
          </p>
        </div>
      </motion.div>

      <AnimatePresence>
        {isRequestModalOpen && (
          <PremiumRequestModal 
            isOpen={isRequestModalOpen} 
            onClose={() => setIsRequestModalOpen(false)} 
            userEmail={userEmail}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
