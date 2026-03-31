import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, User, Phone, MapPin, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PremiumRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
}

type Step = 1 | 2 | 3 | 4;

export default function PremiumRequestModal({ isOpen, onClose, userEmail }: PremiumRequestModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: userEmail || '',
    name: '',
    phone: '',
    plan: 'Starter Plan (₹35)',
    couponCode: ''
  });

  const getPlanPrice = () => {
    if (formData.plan.includes('35')) return 35;
    if (formData.plan.includes('99')) return 99;
    return 0;
  };

  const isDiscountApplied = formData.couponCode.trim().toLowerCase() === 'dibakar';
  const originalPrice = getPlanPrice();
  const discountedPrice = isDiscountApplied ? (originalPrice * 0.95).toFixed(2) : originalPrice;

  const handleNext = () => {
    if (step === 1 && !formData.email) {
      toast.error('Email is required');
      return;
    }
    if (step === 2 && (!formData.name || !formData.phone)) {
      toast.error('Name and Phone are required');
      return;
    }
    setStep((prev) => (prev + 1) as Step);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Construct WhatsApp message
      const adminNumber = '919475954278';
      const message = `*New Premium Request* 🚀\n\n` +
        `*Name:* ${formData.name}\n` +
        `*Email:* ${formData.email}\n` +
        `*Phone:* ${formData.phone}\n` +
        `*Plan:* ${formData.plan}\n` +
        `*Coupon:* ${formData.couponCode || 'None'}\n` +
        `*Final Price:* ₹${discountedPrice}\n\n` +
        `Please contact me for the premium subscription.`;
      
      const whatsappUrl = `https://wa.me/${adminNumber}?text=${encodeURIComponent(message)}`;
      
      // Open WhatsApp
      window.open(whatsappUrl, '_blank');
      
      setStep(4);
      toast.success('WhatsApp opened! Please send the message.');
    } catch (error: any) {
      toast.error('Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-surface border border-border w-[92%] max-w-[400px] rounded-3xl overflow-hidden shadow-2xl relative"
      >
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-surface/50">
          <div>
            <h3 className="text-xl font-bold">Premium Request</h3>
            <p className="text-[10px] text-text-muted uppercase tracking-widest">Step {step} of 3</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
                    <Mail size={12} /> Logged in Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                    className="w-full bg-background border border-border rounded-2xl py-4 px-5 focus:ring-2 ring-primary/50 outline-none transition-all"
                    required
                  />
                </div>
                <p className="text-[10px] text-text-muted text-center italic">
                  This email will be used to contact you.
                </p>
                <button
                  onClick={handleNext}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-all shadow-lg shadow-primary/20"
                >
                  Next <ChevronRight size={18} />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="space-y-3">
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                    <input
                      type="text"
                      placeholder="Your Full Name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-background border border-border rounded-2xl py-4 pl-12 pr-5 focus:ring-2 ring-primary/50 outline-none transition-all"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-background border border-border rounded-2xl py-4 pl-12 pr-5 focus:ring-2 ring-primary/50 outline-none transition-all"
                    />
                  </div>
                </div>
                <button
                  onClick={handleNext}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-all"
                >
                  Next <ChevronRight size={18} />
                </button>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="space-y-3">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Select Your Plan</label>
                  <div 
                    onClick={() => setFormData({ ...formData, plan: 'Starter Plan (₹35)' })}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${formData.plan.includes('35') ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}
                  >
                    <div>
                      <p className="font-bold">Starter Plan</p>
                      <p className="text-xs text-text-muted">₹35 / 70 Requests</p>
                    </div>
                    {formData.plan.includes('35') && <CheckCircle2 className="text-primary" size={20} />}
                  </div>
                  <div 
                    onClick={() => setFormData({ ...formData, plan: 'Pro Plan (₹99)' })}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${formData.plan.includes('99') ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}
                  >
                    <div>
                      <p className="font-bold">Pro Plan</p>
                      <p className="text-xs text-text-muted">₹99 / 300 Requests</p>
                    </div>
                    {formData.plan.includes('99') && <CheckCircle2 className="text-primary" size={20} />}
                  </div>

                  {/* Coupon Code Section */}
                  <div className="space-y-2 pt-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Have a coupon code?</label>
                    <input
                      type="text"
                      placeholder="Enter coupon code"
                      value={formData.couponCode}
                      onChange={(e) => setFormData({ ...formData, couponCode: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl py-3 px-4 focus:ring-2 ring-primary/50 outline-none transition-all text-sm"
                    />
                    {isDiscountApplied && (
                      <p className="text-[10px] text-green-500 font-bold flex items-center gap-1">
                        <CheckCircle2 size={10} /> 5% Discount Applied!
                      </p>
                    )}
                  </div>

                  {/* Price Summary */}
                  <div className="p-4 bg-surface-hover rounded-2xl border border-border space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">Plan Price:</span>
                      <span className={isDiscountApplied ? 'line-through text-text-muted' : 'font-bold'}>₹{originalPrice}</span>
                    </div>
                    {isDiscountApplied && (
                      <div className="flex justify-between text-sm font-bold text-primary">
                        <span>Discounted Price:</span>
                        <span>₹{discountedPrice}</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Submit via WhatsApp'}
                </button>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8 space-y-4"
              >
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="text-green-500" size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Request Successful!</h3>
                  <p className="text-sm text-text-muted px-4">
                    Your request has been sent to Dibakar AI Team via WhatsApp. 
                    Apna premium request liya gaya hai. Under 24 hours Dibakar AI team ap sa contact karega.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-full bg-surface-hover border border-border py-4 rounded-2xl font-bold hover:bg-surface transition-all mt-4"
                >
                  Close
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {step < 4 && (
          <div className="p-4 bg-surface-hover/50 text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-widest">
              Dibakar AI Premium Support
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
