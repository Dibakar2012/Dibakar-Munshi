import React, { useEffect, useRef, useState } from 'react';
import { databases, APPWRITE_CONFIG, Query } from '../lib/appwrite';
import { Message, SearchSource, UserProfile } from '../types';
import ReactMarkdown from 'react-markdown';
import { ExternalLink, Globe, User, Bot, Loader2, Copy, Check, ArrowDown, ThumbsUp, ThumbsDown, Zap, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const INITIAL_LIMIT = 20;

function cleanMessageContent(content: string) {
  // Remove common source/reference headers and everything after them
  // Also remove bracketed citations like [1], [2]
  return content
    .replace(/(?:\n|^)(?:Sources|References|संदर्भ|উৎস|Links|Citations):[\s\S]*$/i, '')
    .replace(/\[\d+\]/g, '')
    .trim();
}

interface ChatAreaProps {
  chatId: string | null;
  isSearching: boolean;
  user: UserProfile | null;
  optimisticQuery?: string | null;
}

function SourcesToggle({ sources }: { sources: SearchSource[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-xs font-bold uppercase tracking-widest shadow-sm",
          isOpen 
            ? "bg-primary text-white border-primary" 
            : "bg-surface border-border text-text-muted hover:border-primary hover:text-primary"
        )}
      >
        <Globe size={14} className={cn("transition-transform", isOpen && "rotate-12")} />
        {isOpen ? "Hide Sources" : `View ${sources.length} Sources`}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -10 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -10 }}
            className="overflow-hidden mt-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sources.map((source, i) => (
                <motion.a
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  href={source.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-surface/50 backdrop-blur-sm border border-border rounded-2xl hover:border-primary transition-all group flex flex-col gap-1.5 shadow-sm active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Globe className="text-primary w-3 h-3" />
                      </div>
                      <span className="text-[9px] text-text-muted truncate uppercase tracking-widest font-black">Source {i + 1}</span>
                    </div>
                    <ExternalLink className="text-text-muted group-hover:text-primary w-3 h-3" />
                  </div>
                  <h4 className="text-xs font-bold line-clamp-2 group-hover:text-primary leading-tight">{source.title}</h4>
                  <p className="text-[10px] text-text-muted/60 truncate font-medium">{new URL(source.link).hostname}</p>
                </motion.a>
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

function FeedbackButtons({ chatId, messageId, feedback, onUpdate }: { chatId: string, messageId: string, feedback?: 'up' | 'down' | null, onUpdate: () => void }) {
  const handleFeedback = async (type: 'up' | 'down') => {
    try {
      const newFeedback = feedback === type ? null : type;
      await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: newFeedback })
      });
      onUpdate();
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

export default function ChatArea({ chatId, isSearching, user, optimisticQuery }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [msgLimit, setMsgLimit] = useState(INITIAL_LIMIT);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollHeight = useRef<number>(0);
  const isAutoScrolling = useRef(true);

  const fetchMessages = async () => {
    if (!chatId) return;
    try {
      const response = await fetch(`/api/messages?chatId=${chatId}`);
      if (!response.ok) return;
      const documents = await response.json();
      
      const newMessages = documents.map((doc: any) => ({ 
        id: doc.$id, 
        chatId: doc.chatId,
        role: doc.role,
        content: doc.content,
        sources: doc.sources ? JSON.parse(doc.sources) : [],
        feedback: doc.feedback,
        createdAt: doc.createdAt
      } as Message));
      
      setMessages(newMessages);
      
      if (documents.length < msgLimit) {
        setHasMore(false);
      }
    } catch (err) {
      // Silent error to avoid UI noise during polling
    }
  };

  // Reset scroll lock when a new search starts
  useEffect(() => {
    if (isSearching) {
      setUserScrolledUp(false);
      isAutoScrolling.current = true;
    }
  }, [isSearching]);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setMsgLimit(INITIAL_LIMIT);
      setHasMore(true);
      return;
    }

    setMsgLimit(INITIAL_LIMIT);
    setHasMore(true);
    fetchMessages();

    // Optimized Polling: Poll faster when searching, slower otherwise to save 1GB RAM resources
    const pollInterval = isSearching ? 1500 : 8000;
    const interval = setInterval(fetchMessages, pollInterval);
    return () => clearInterval(interval);
  }, [chatId, msgLimit, isSearching]);

  // Scroll to bottom on new messages or when searching
  useEffect(() => {
    const container = containerRef.current;
    if (!container || userScrolledUp) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // Threshold to determine if user is "at the bottom"
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 150;

    if (isAtBottom || isSearching) {
      const timeoutId = setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, isSearching, optimisticQuery, userScrolledUp]);

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
    
    // Detect if user is scrolling up manually
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    if (!isAtBottom && !isSearching) {
      // If user scrolls up while NOT searching, lock the scroll
      // We don't lock if searching because we want to follow the response
    } else if (isAtBottom) {
      setUserScrolledUp(false);
    }

    // If user scrolls up significantly, show scroll button and lock auto-scroll
    const scrollDiff = scrollHeight - scrollTop - clientHeight;
    if (scrollDiff > 300) {
      setShowScrollButton(true);
      if (!isSearching) setUserScrolledUp(true);
    } else {
      setShowScrollButton(false);
    }

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
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full relative overflow-hidden">
        {/* Decorative Background Blobs - Reduced opacity and size */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none">
          <div className="absolute top-1/3 left-1/3 w-48 h-48 bg-primary/5 rounded-full blur-[80px] animate-pulse" />
          <div className="absolute bottom-1/3 right-1/3 w-48 h-48 bg-secondary/5 rounded-full blur-[80px] animate-pulse delay-1000" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center space-y-6 w-full relative z-10"
        >
          <div className="space-y-4">
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              Dibakar <span className="text-primary drop-shadow-[0_0_10px_rgba(0,255,150,0.2)]">AI</span>
            </h1>
            <motion.div 
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.4, duration: 1, ease: "circOut" }}
              className="h-px w-16 bg-gradient-to-r from-transparent via-primary/40 to-transparent mx-auto"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-fluid space-y-fluid relative"
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
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ 
              duration: 0.4, 
              ease: [0.23, 1, 0.32, 1],
              delay: Math.min(idx * 0.05, 0.3) // Stagger but cap it
            }}
            className="w-full"
          >
            <div className={cn(
              "flex gap-3 md:gap-6 max-w-3xl mx-auto w-full",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1 shadow-sm border border-primary/5">
                  <Bot className="text-primary w-3.5 h-3.5 md:w-4.5 md:h-4.5" />
                </div>
              )}
              <div className={cn(
                "flex flex-col gap-2 md:gap-4 group",
                msg.role === 'user' ? "items-end max-w-[85%] ml-auto" : "items-start flex-1"
              )}>
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <SourcesToggle sources={msg.sources} />
                )}
                
                <div className={cn(
                  "relative",
                  msg.role === 'user' 
                    ? "px-4 py-2.5 rounded-[1.5rem] rounded-tr-none bg-primary text-white shadow-lg w-fit max-w-full" 
                    : "pt-0 w-full"
                )}>
                  <div className={cn(
                    "prose prose-sm md:prose-base max-w-none leading-relaxed",
                    msg.role === 'assistant' ? "prose-headings:text-text prose-p:text-text/90" : "text-white font-semibold"
                  )}>
                    <ReactMarkdown>
                      {msg.role === 'assistant' ? cleanMessageContent(msg.content) : msg.content}
                    </ReactMarkdown>
                  </div>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mt-4 md:mt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      <FeedbackButtons chatId={chatId!} messageId={msg.id} feedback={msg.feedback} onUpdate={fetchMessages} />
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

        {/* Optimistic User Message */}
        {isSearching && optimisticQuery && !messages.some(m => m.content === optimisticQuery && m.role === 'user') && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full"
          >
            <div className="flex gap-3 md:gap-6 max-w-3xl mx-auto w-full justify-end">
              <div className="flex flex-col items-end max-w-[85%] ml-auto gap-2">
                <div className="px-4 py-2.5 rounded-[1.5rem] rounded-tr-none bg-primary text-white shadow-lg w-fit max-w-full">
                  <div className="text-white font-semibold prose prose-sm md:prose-base max-w-none leading-relaxed">
                    <ReactMarkdown>{optimisticQuery}</ReactMarkdown>
                  </div>
                </div>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 md:w-4.5 md:h-4.5" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Thinking State */}
        {isSearching && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 md:gap-6 max-w-3xl mx-auto w-full justify-start"
          >
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1 shadow-sm border border-primary/5">
              <Bot className="text-primary w-3.5 h-3.5 md:w-4.5 md:h-4.5" />
            </div>
            <div className="flex items-center gap-2 text-text-muted text-xs font-medium bg-surface/50 px-4 py-2 rounded-2xl border border-border italic">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              Dibakar AI is thinking...
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
