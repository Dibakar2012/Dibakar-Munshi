import React, { useState, useRef, useEffect } from 'react';
import { Send, Search, Sparkles, Mic, MicOff } from 'lucide-react';
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
    <div className="p-4 md:p-10 relative">
      <motion.form
        onSubmit={handleSubmit}
        initial={false}
        animate={{
          scale: isFocused ? 1.01 : 1,
          boxShadow: isFocused 
            ? "0 0 50px rgba(59, 130, 246, 0.25), 0 0 0 2px rgba(59, 130, 246, 0.5)" 
            : "0 0 0 1px var(--color-border)",
          backgroundColor: "var(--color-surface)"
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={cn(
          "max-w-4xl mx-auto backdrop-blur-2xl rounded-[2rem] p-3 flex items-end gap-3 transition-all relative overflow-hidden border border-white/10",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Progress Bar for searching state */}
        <AnimatePresence>
          {disabled && (
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ 
                repeat: Infinity, 
                duration: 1.5, 
                ease: "linear" 
              }}
              className="absolute top-0 left-0 h-[2px] w-full bg-gradient-to-r from-transparent via-primary to-transparent z-50"
            />
          )}
        </AnimatePresence>

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

        <div className="p-3 text-text-muted hidden md:flex items-center justify-center relative z-10">
          <motion.div
            animate={{ rotate: isFocused ? 90 : 0, color: isFocused ? "#3b82f6" : "#9ca3af" }}
          >
            <Search size={22} />
          </motion.div>
        </div>

        <textarea
          ref={textareaRef}
          rows={1}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Ask Dibakar AI"
          disabled={disabled}
          autoFocus
          className="flex-1 bg-transparent border-none outline-none py-3 px-3 md:px-0 resize-none text-base md:text-xl text-text font-black placeholder:text-text-muted/60 relative z-10 min-h-[48px] custom-scrollbar"
        />

        <div className="flex items-center gap-2 pr-1 pb-1 relative z-10">
          <motion.button
            type="button"
            onClick={toggleListening}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "p-3 rounded-2xl transition-all shadow-lg",
              isListening 
                ? "bg-red-500 text-white animate-pulse shadow-red-500/20" 
                : "bg-white/5 text-text-muted/40 hover:bg-white/10 hover:text-white"
            )}
            title={isListening ? "Stop Listening" : "Start Voice Search"}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </motion.button>

          <AnimatePresence>
            {query.trim() && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="hidden md:flex items-center gap-1 text-[10px] font-bold text-primary/60 uppercase tracking-widest px-2"
              >
                <Sparkles size={12} />
                Ready
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={!query.trim() || disabled}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "p-3 rounded-2xl transition-all shadow-lg",
              query.trim() && !disabled 
                ? "bg-primary text-white shadow-primary/20" 
                : "bg-white/5 text-text-muted/40"
            )}
          >
            <Send size={20} className={cn("transition-transform", query.trim() && "rotate-12")} />
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
        <p className="text-center text-[10px] text-text-muted/50 font-medium uppercase tracking-[0.2em]">
          Powered by Dibakar AI
        </p>
        <div className="h-px w-12 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </motion.div>
    </div>
  );
}
