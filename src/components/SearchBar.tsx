import React, { useState, useRef, useEffect } from 'react';
import { Send, Search, Sparkles, Mic, MicOff, Plus, Globe, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  disabled?: boolean;
  chatId?: string | null;
}

export default function SearchBar({ onSearch, disabled, chatId }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;

        recognitionRef.current.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0])
            .map((result: any) => result.transcript)
            .join('');
          setQuery(transcript);
          
          // Auto-resize textarea
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
          }
        };

        recognitionRef.current.onstart = () => {
          setIsListening(true);
          setSpeechError(null);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          
          if (event.error === 'not-allowed') {
            setSpeechError('Microphone access denied. Please enable it in your browser settings.');
          } else if (event.error === 'no-speech') {
            setSpeechError('No speech detected. Please try again.');
          } else {
            setSpeechError(`Error: ${event.error}`);
          }
          
          // Clear error after 5 seconds
          setTimeout(() => setSpeechError(null), 5000);
        };
      } catch (err) {
        console.error('Failed to initialize speech recognition:', err);
      }
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (err) {
        console.error('Error stopping recognition:', err);
        setIsListening(false);
      }
    } else {
      if (!recognitionRef.current) {
        alert('Speech recognition is not supported in your browser.');
        return;
      }
      
      if (!window.isSecureContext) {
        alert('Speech recognition requires a secure (HTTPS) connection.');
        return;
      }

      setQuery('');
      setSpeechError(null);
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.error('Error starting recognition:', err);
        // If it's already started, just update state
        if (err instanceof Error && err.message.includes('already started')) {
          setIsListening(true);
        } else {
          setSpeechError('Could not start microphone. Please try again.');
          setIsListening(false);
        }
      }
    }
  };

  useEffect(() => {
    // Automatically focus the input ONLY when starting a new chat
    if (!chatId && !disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [chatId]);

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim() && !disabled) {
      onSearch(query.trim());
      setQuery('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-fluid relative">
      <motion.form
        onSubmit={handleSubmit}
        initial={false}
        animate={{
          scale: isFocused ? 1.005 : 1,
          boxShadow: isFocused 
            ? "0 0 40px rgba(0, 255, 150, 0.1), 0 0 0 1px rgba(0, 255, 150, 0.2)" 
            : "0 0 0 1px var(--color-border)",
          backgroundColor: isFocused ? "rgba(10, 18, 15, 0.8)" : "var(--color-surface)"
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(
          "w-full max-w-3xl mx-auto backdrop-blur-3xl rounded-2xl md:rounded-3xl p-1.5 md:p-2 flex items-end gap-1 md:gap-2 transition-all relative overflow-hidden border border-white/5",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Progress Bar for searching state removed as requested */}

        {/* Subtle background glow when focused */}
        <AnimatePresence>
          {isFocused && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none"
            />
          )}
        </AnimatePresence>

        <textarea
          ref={textareaRef}
          rows={1}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Ask anything..."
          disabled={disabled}
          autoFocus
          className="flex-1 bg-transparent border-none outline-none py-3 px-4 md:px-2 resize-none text-base md:text-lg text-text font-medium placeholder:text-text-muted/60 relative z-10 min-h-[44px] md:min-h-[48px] custom-scrollbar"
        />

        <div className="flex items-center gap-1 md:gap-2 pr-1 pb-1 relative z-10">
          <motion.button
            type="button"
            onClick={toggleListening}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "p-2.5 rounded-xl transition-all",
              isListening 
                ? "bg-red-500 text-white" 
                : "text-text-muted hover:text-white"
            )}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </motion.button>

          <motion.button
            type="submit"
            disabled={!query.trim() || disabled}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "p-2.5 rounded-xl transition-all",
              query.trim() && !disabled 
                ? "bg-primary text-black" 
                : "bg-surface-hover text-text-muted/40"
            )}
          >
            <ArrowRight size={20} />
          </motion.button>
        </div>
      </motion.form>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col items-center gap-1 mt-4"
      >
        <AnimatePresence>
          {speechError && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-[10px] text-red-500 font-bold uppercase tracking-wider mb-2"
            >
              {speechError}
            </motion.p>
          )}
        </AnimatePresence>
        <p className="text-center text-[9px] text-text-muted/30 font-medium uppercase tracking-[0.3em] transition-opacity hover:opacity-100">
          Powered by Dibakar AI
        </p>
        <div className="h-px w-12 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </motion.div>
    </div>
  );
}
