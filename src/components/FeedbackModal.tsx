import React, { useState } from 'react';
import { Star, X, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { databases, account, APPWRITE_CONFIG } from '../lib/appwrite';
import { ID } from 'appwrite';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

import { UserProfile } from '../types';

interface FeedbackModalProps {
  user: UserProfile;
  onClose: () => void;
}

export default function FeedbackModal({ user, onClose }: FeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('Please select a star rating');
      return;
    }

    try {
      setIsSubmitting(true);
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          userEmail: user.email,
          rating,
          comment
        })
      });
      toast.success('Thank you for your feedback!');
      onClose();
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-[92%] max-w-[400px] bg-surface border border-border rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary" />
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-surface-hover rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Share Your Feedback</h2>
          <p className="text-sm text-text-muted">How would you rate your experience with Dibakar?</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  size={32}
                  className={cn(
                    "transition-colors",
                    (hover || rating) >= star 
                      ? "fill-yellow-400 text-yellow-400" 
                      : "text-text-muted/30"
                  )}
                />
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-text-muted uppercase tracking-widest px-1">
              Comment (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us what you think..."
              className="w-full bg-background border border-border rounded-2xl p-4 text-sm focus:outline-none focus:border-primary transition-colors resize-none h-32 custom-scrollbar"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || rating === 0}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all shadow-lg",
              rating > 0 && !isSubmitting
                ? "bg-primary text-white shadow-primary/20 hover:bg-blue-600"
                : "bg-surface-hover text-text-muted cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <Send size={18} />
                Submit Feedback
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
