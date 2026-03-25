import React, { useEffect, useRef, useState } from 'react';
import { collection, query, orderBy, onSnapshot, limit, startAfter, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Message, SearchSource } from '../types';
import ReactMarkdown from 'react-markdown';
import { ExternalLink, Globe, User, Bot, Loader2, Copy, Check, ArrowDown, ThumbsUp, ThumbsDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const INITIAL_LIMIT = 20;

interface ChatAreaProps {
  chatId: string | null;
  isSearching: boolean;
}

function SourcesToggle({ sources }: { sources: SearchSource[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-xs font-bold",
          isOpen 
            ? "bg-primary/10 border-primary text-primary" 
            : "bg-surface border-border text-text-muted hover:bg-surface-hover hover:text-white"
        )}
      >
        <Globe size={14} />
        {isOpen ? "Hide Sources" : `View ${sources.length} Sources`}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
              {sources.map((source, i) => (
                <a
                  key={i}
                  href={source.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-surface border border-border rounded-xl hover:border-primary transition-all group flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Globe size={12} className="text-primary" />
                      <span className="text-[9px] text-text-muted truncate uppercase tracking-widest font-bold">Source {i + 1}</span>
                    </div>
                    <ExternalLink size={10} className="text-text-muted group-hover:text-primary" />
                  </div>
                  <h4 className="text-xs font-bold truncate group-hover:text-primary">{source.title}</h4>
                  <p className="text-[10px] text-text-muted line-clamp-2 mt-0.5 leading-relaxed">{source.snippet}</p>
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "p-1.5 rounded-lg border transition-all hover:bg-surface-hover",
        copied ? "border-green-500 text-green-500" : "border-border text-text-muted hover:text-white"
      )}
      title="Copy to clipboard"
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.div
            key="check"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
          >
            <Check size={14} />
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
          >
            <Copy size={14} />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

function FeedbackButtons({ chatId, messageId, feedback }: { chatId: string, messageId: string, feedback?: 'up' | 'down' | null }) {
  const handleFeedback = async (type: 'up' | 'down') => {
    try {
      const newFeedback = feedback === type ? null : type;
      await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
        feedback: newFeedback
      });
    } catch (err) {
      console.error('Failed to update feedback: ', err);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleFeedback('up')}
        className={cn(
          "p-1.5 rounded-lg border transition-all hover:bg-surface-hover",
          feedback === 'up' ? "border-primary text-primary bg-primary/10" : "border-border text-text-muted hover:text-white"
        )}
        title="Helpful"
      >
        <ThumbsUp size={14} />
      </button>
      <button
        onClick={() => handleFeedback('down')}
        className={cn(
          "p-1.5 rounded-lg border transition-all hover:bg-surface-hover",
          feedback === 'down' ? "border-red-500 text-red-500 bg-red-500/10" : "border-border text-text-muted hover:text-white"
        )}
        title="Not helpful"
      >
        <ThumbsDown size={14} />
      </button>
    </div>
  );
}

export default function ChatArea({ chatId, isSearching }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [msgLimit, setMsgLimit] = useState(INITIAL_LIMIT);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollHeight = useRef<number>(0);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setMsgLimit(INITIAL_LIMIT);
      setHasMore(true);
      return;
    }

    // Reset for new chat
    setMsgLimit(INITIAL_LIMIT);
    setHasMore(true);

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(msgLimit)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)).reverse();
      setMessages(newMessages);
      
      // If we got fewer messages than the limit, we've reached the end
      if (snapshot.docs.length < msgLimit) {
        setHasMore(false);
      }
    });

    return () => unsubscribe();
  }, [chatId, msgLimit]);

  // Scroll to bottom on new messages or when searching
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // Threshold to determine if user is "at the bottom"
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 200;

    if (isAtBottom || isSearching) {
      // Use a small delay to ensure the DOM has updated with new content
      const timeoutId = setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, isSearching]);

  // Maintain scroll position when loading more
  useEffect(() => {
    if (containerRef.current && lastScrollHeight.current > 0) {
      const newScrollHeight = containerRef.current.scrollHeight;
      const heightDiff = newScrollHeight - lastScrollHeight.current;
      containerRef.current.scrollTop += heightDiff;
      lastScrollHeight.current = 0;
    }
  }, [messages]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    // Show scroll button if user scrolls up significantly (more than 300px from bottom)
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 300;
    setShowScrollButton(isScrolledUp);

    if (scrollTop === 0 && hasMore && !loadingMore && messages.length >= msgLimit) {
      setLoadingMore(true);
      lastScrollHeight.current = scrollHeight;
      
      // Simulate a small delay for better UX and then increase limit
      setTimeout(() => {
        setMsgLimit(prev => prev + INITIAL_LIMIT);
        setLoadingMore(false);
      }, 500);
    }
  };

  if (!chatId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
        >
          Dibakar AI
        </motion.h1>
        <p className="text-text-muted max-w-md">
          The next generation AI search engine. Ask anything and get structured, accurate answers with real-time web sources.
        </p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 relative"
    >
      {/* Top Progress Bar for searching state */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="sticky top-0 left-0 right-0 z-20 h-1 w-full bg-surface overflow-hidden"
          >
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ 
                repeat: Infinity, 
                duration: 2, 
                ease: "easeInOut" 
              }}
              className="h-full w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {hasMore && (
        <div className="flex justify-center py-4">
          {loadingMore ? (
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          ) : (
            <span className="text-xs text-text-muted">Scroll up to load older messages</span>
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
        {messages.map((msg, idx) => (
          <motion.div
            key={msg.id || idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex gap-3 md:gap-4 max-w-4xl mx-auto",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Bot size={16} className="md:w-[18px] md:h-[18px]" />
              </div>
            )}
            <div className={cn(
              "flex flex-col gap-2 max-w-[85%] md:max-w-none group",
              msg.role === 'user' ? "items-end" : "items-start"
            )}>
              <div className={cn(
                "p-3 md:p-4 rounded-2xl relative",
                msg.role === 'user' ? "bg-primary text-white" : "bg-surface border border-border"
              )}>
                <div className="prose prose-sm md:prose-base max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                {msg.role === 'assistant' && (
                  <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <FeedbackButtons chatId={chatId!} messageId={msg.id} feedback={msg.feedback} />
                    <CopyButton content={msg.content} />
                  </div>
                )}
              </div>

              {msg.sources && msg.sources.length > 0 && (
                <SourcesToggle sources={msg.sources} />
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
                <User size={18} />
              </div>
            )}
          </motion.div>
        ))}

        {isSearching && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-4 max-w-4xl mx-auto"
          >
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Loader2 size={18} className="text-primary animate-spin" />
            </div>
            <div className="bg-surface/50 border border-border/50 p-4 rounded-2xl w-full backdrop-blur-sm">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="w-1.5 h-1.5 bg-primary rounded-full" 
                    />
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                      className="w-1.5 h-1.5 bg-primary rounded-full" 
                    />
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                      className="w-1.5 h-1.5 bg-primary rounded-full" 
                    />
                  </div>
                  <span className="text-sm font-bold text-primary uppercase tracking-widest">Thinking...</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="h-full w-1/2 bg-gradient-to-r from-transparent via-primary to-transparent"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div ref={scrollRef} />

      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 p-3 rounded-full bg-primary text-white shadow-2xl hover:bg-primary/90 transition-colors z-50 border border-white/10"
            title="Scroll to bottom"
          >
            <ArrowDown size={20} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
