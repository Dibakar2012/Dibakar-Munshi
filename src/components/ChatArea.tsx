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
    <div className="w-full mb-2">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
        {sources.slice(0, 3).map((source, i) => (
          <a
            key={i}
            href={source.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-2.5 md:px-3 py-1 md:py-1.5 bg-surface border border-border rounded-lg hover:border-primary transition-all shrink-0 max-w-[120px] md:max-w-[150px]"
          >
            <div className="w-3.5 h-3.5 md:w-4 md:h-4 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <Globe className="text-primary w-2 h-2 md:w-2.5 md:h-2.5" />
            </div>
            <span className="text-[9px] md:text-[10px] font-bold truncate text-text-muted group-hover:text-primary">{source.title}</span>
          </a>
        ))}
        {sources.length > 3 && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1 px-2.5 md:px-3 py-1 md:py-1.5 bg-surface border border-border rounded-lg hover:border-primary transition-all text-[9px] md:text-[10px] font-bold text-text-muted shrink-0"
          >
            +{sources.length - 3}
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 md:gap-2 mt-2">
              {sources.map((source, i) => (
                <a
                  key={i}
                  href={source.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 md:p-2 bg-surface border border-border rounded-lg md:rounded-xl hover:border-primary transition-all group flex flex-col gap-0.5 md:gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 md:gap-1.5">
                      <Globe className="text-primary w-2 h-2 md:w-2.5 md:h-2.5" />
                      <span className="text-[7px] md:text-[8px] text-text-muted truncate uppercase tracking-widest font-bold">Source {i + 1}</span>
                    </div>
                    <ExternalLink className="text-text-muted group-hover:text-primary w-2 h-2 md:w-2.5 md:h-2.5" />
                  </div>
                  <h4 className="text-[9px] md:text-[10px] font-bold truncate group-hover:text-primary">{source.title}</h4>
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
      try {
        const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)).reverse();
        setMessages(newMessages);
        
        // If we got fewer messages than the limit, we've reached the end
        if (snapshot.docs.length < msgLimit) {
          setHasMore(false);
        }
      } catch (err: any) {
        console.error('Error processing messages snapshot:', err);
      }
    }, (err) => {
      console.error('Firestore snapshot error in ChatArea:', err);
      if (err.message?.includes('Missing or insufficient permissions')) {
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
        <p className="text-text-muted max-w-sm text-sm">
          The next generation AI search engine. Ask anything and get structured, accurate answers with real-time web sources.
        </p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-8 relative"
    >
      {/* Top Progress Bar for searching state removed as requested */}

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
            className="w-full"
          >
            <div className={cn(
              "flex gap-2 md:gap-6 max-w-2xl mx-auto w-full",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}>
              {msg.role === 'assistant' && (
                <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="text-primary w-3 h-3 md:w-3.5 md:h-3.5" />
                </div>
              )}
              <div className={cn(
                "flex flex-col gap-3 md:gap-4 group",
                msg.role === 'user' ? "items-end max-w-[90%] md:max-w-[85%] ml-auto" : "items-start flex-1"
              )}>
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <SourcesToggle sources={msg.sources} />
                )}
                
                <div className={cn(
                  "relative",
                  msg.role === 'user' 
                    ? "px-3.5 md:px-4 py-2 md:py-2.5 rounded-2xl bg-primary text-white shadow-sm w-fit max-w-full" 
                    : "pt-0 w-full"
                )}>
                  <div className={cn(
                    "prose prose-sm md:prose-base max-w-none leading-relaxed",
                    msg.role === 'assistant' ? "prose-headings:text-text prose-p:text-text/90" : "text-white font-medium"
                  )}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mt-4 md:mt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      <FeedbackButtons chatId={chatId!} messageId={msg.id} feedback={msg.feedback} />
                      <CopyButton content={msg.content} />
                    </div>
                  )}
                </div>
              </div>
              {msg.role === 'user' && (
                <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 md:w-4.5 md:h-4.5" />
                </div>
              )}
            </div>
          </motion.div>
        ))}
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
