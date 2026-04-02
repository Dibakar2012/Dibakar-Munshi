import React, { useEffect, useState } from 'react';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from './lib/firebase';
import { databases, APPWRITE_CONFIG, ID, Query } from './lib/appwrite';
import { generateSearchResponse, generateChatTitle } from './lib/geminiService';
import { UserProfile, Chat, Message, SearchResponse } from './types';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SearchBar from './components/SearchBar';
import AdminDashboard from './components/AdminDashboard';
import Paywall from './components/Paywall';
import PermissionPopup from './components/PermissionPopup';
import FeedbackModal from './components/FeedbackModal';
import { LogIn, LogOut, CreditCard, User, ShieldCheck, ShieldAlert, MoreVertical, History, LayoutDashboard, Phone, Zap, Sun, Moon, MessageSquarePlus, Mail, Lock, Eye, EyeOff, CheckCircle2, ArrowRight, ChevronDown, Plus, Mic, Globe, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { toast, Toaster } from 'sonner';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [currentQuery, setCurrentQuery] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showPermissionPopup, setShowPermissionPopup] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  useEffect(() => {
    // Handle mobile viewport height issues
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);
    
    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsDarkMode(false);
      document.documentElement.classList.add('light');
    }

    // Check if permissions have been seen
    const hasSeenPermissions = localStorage.getItem('hasSeenPermissions');
    if (!hasSeenPermissions) {
      setShowPermissionPopup(true);
    }
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    console.log('Theme toggled. New mode is dark:', newMode);
    if (newMode) {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  };

  useEffect(() => {
    // Safety timeout for loading state
    const loadingTimeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          console.warn('Loading safety timeout reached');
          return false;
        }
        return prev;
      });
    }, 15000); // 15 seconds

    async function initAuth() {
      try {
        console.log('Checking Firebase session...');
        onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            console.log('Firebase user found:', firebaseUser.email);
            // Sync user profile with Appwrite via backend
            await syncUserProfile(firebaseUser);
          } else {
            console.log('No active Firebase session');
            setUser(null);
            setIsAuthReady(true);
            setLoading(false);
          }
        });
      } catch (err: any) {
        console.error('Auth init error:', err.message);
        setUser(null);
        setIsAuthReady(true);
        setLoading(false);
      }
    }

    async function syncUserProfile(firebaseUser: any) {
      try {
        const response = await fetch('/api/user/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName
          })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to sync user profile');
        }
        
        const doc = data;
        const userProfile = {
          uid: doc.$id,
          name: doc.name || firebaseUser.displayName || 'User',
          email: doc.email || firebaseUser.email || '',
          role: doc.role || 'user',
          credits: doc.credits !== undefined ? doc.credits : 10,
          createdAt: doc.createdAt || new Date().toISOString(),
          isVirtual: doc.isVirtual,
          warning: doc.warning
        } as UserProfile;

        if (doc.isVirtual) {
          toast.error("Appwrite Setup Required", {
            description: doc.warning,
            duration: 10000,
          });
        }

        setUser(userProfile);
        setIsAuthReady(true);
        setLoading(false);
      } catch (err: any) {
        console.error('Error syncing user profile:', err);
        setError(`Sync Error: ${err.message}`);
        setLoading(false);
      }
    }

    initAuth();

    return () => {
      clearTimeout(loadingTimeout);
    };
  }, []);

  const [isPaywallOpen, setIsPaywallOpen] = useState(false);

  const loginInProgress = React.useRef(false);

  const handleLogin = async () => {
    if (loginInProgress.current) {
      console.warn('Login already in progress...');
      return;
    }

    console.log('Attempting login with Firebase Google...');
    setLoading(true);
    setError(null);
    loginInProgress.current = true;

    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle the rest
    } catch (error: any) {
      console.error('Login Error:', error.code, error.message);
      
      if (error.code === 'auth/popup-blocked') {
        setError('Popup blocked by browser. Please enable popups for this site and try again.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        setError('Login request was cancelled. Please try again.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        setError('Login window was closed. Please try again.');
      } else {
        setError(`Login failed: ${error.message}`);
      }
      
      setLoading(false);
    } finally {
      loginInProgress.current = false;
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setIsAuthReady(false);
    } catch (err: any) {
      console.error('Logout error:', err);
      toast.error('Logout failed');
    }
  };

  const handleSearch = async (queryText: string) => {
    console.log('handleSearch called with:', queryText);
    if (!user) {
      console.warn('handleSearch: No user found');
      return;
    }
    
    if (user.credits <= 0 && user.role !== 'admin') {
      console.warn('handleSearch: Not enough credits and not admin');
      toast.error('You have run out of credits. Please upgrade to continue.');
      setIsPaywallOpen(true);
      return;
    }

    setIsSearching(true);
    setCurrentQuery(queryText);
    let chatId = currentChatId;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    try {
      // 1. Create new chat if none selected
      if (!chatId) {
        if (user && !user.isVirtual) {
          const res = await fetch('/api/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.uid,
              title: queryText.slice(0, 40) + (queryText.length > 40 ? '...' : '')
            })
          });
          const chatDoc = await res.json();
          chatId = chatDoc.$id;
          setCurrentChatId(chatId);
        } else {
          // Virtual mode: use a temporary ID
          chatId = 'virtual_' + Date.now();
          setCurrentChatId(chatId);
        }
      } else if (user && !user.isVirtual) {
        // Update existing chat's updatedAt (don't await, it's not critical for search)
        fetch(`/api/chats/${chatId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updatedAt: new Date().toISOString() })
        }).catch(e => console.error('Chat update error:', e));
      }

      // 2. Add user message and get history in parallel
      let history = [];
      if (user && !user.isVirtual) {
        const [userMsgRes, historyRes] = await Promise.all([
          fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId,
              role: 'user',
              content: queryText
            })
          }),
          fetch(`/api/messages?chatId=${chatId}`)
        ]);

        const historyDocs = await historyRes.json();
        history = historyDocs
          .slice(-6)
          .map((doc: any) => ({ role: doc.role, content: doc.content }))
          .filter((m: any) => m.content !== 'Thinking...');
      }

      // 3. Create assistant message placeholder and start search in parallel
      let assistantMsgDoc = null;
      const searchPromise = fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText, history: history.slice(-5) }),
        signal: controller.signal
      });

      if (user && !user.isVirtual) {
        const [assistantMsgRes, searchRes] = await Promise.all([
          fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId,
              role: 'assistant',
              content: 'Thinking...',
              sources: JSON.stringify([])
            })
          }),
          searchPromise
        ]);
        assistantMsgDoc = await assistantMsgRes.json();
        var searchResponse = searchRes;
      } else {
        var searchResponse = await searchPromise;
      }

      clearTimeout(timeoutId);

      const response = searchResponse;
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${text.slice(0, 100)}...`);
      }

      if (!response.ok) throw new Error(data.error || 'Search failed');

      if (assistantMsgDoc && user && !user.isVirtual) {
        await fetch(`/api/messages/${assistantMsgDoc.$id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: data.answer,
            sources: JSON.stringify(data.sources || [])
          })
        });
      }

      // 6. Generate a better title if it's a new chat
      if (!currentChatId && user && !user.isVirtual) {
        generateChatTitle(queryText).then(newTitle => {
          if (chatId) {
            fetch(`/api/chats/${chatId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: newTitle })
            }).catch(e => console.error('Title update error:', e));
          }
        }).catch(e => console.error('Title generation error:', e));
      }

      // 7. Deduct credit if not admin
      if (user && user.uid && user.role !== 'admin') {
        try {
          await fetch(`/api/user/${user.uid}/credits`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credits: user.credits - 1 })
          });
        } catch (updateErr) {
          console.error('Failed to update credits:', updateErr);
        }
      }

    } catch (error: any) {
      console.error('Search Error:', error);
      toast.error(`Search failed: ${error.message || 'Something went wrong'}`);
    } finally {
      setIsSearching(false);
      setCurrentQuery(null);
    }
  };

  if (loading && !error) {
    return (
      <div className="h-[100dvh] bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-primary font-medium animate-pulse">Loading Dibakar...</p>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="h-[100dvh] bg-background flex flex-col items-center justify-center p-4 text-center overflow-hidden relative">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full auth-card p-8 rounded-[3rem] space-y-6 relative z-10 border border-white/10 shadow-2xl"
        >
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <ShieldAlert className="text-red-500" size={32} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-white">CONNECTION ERROR</h1>
          <p className="text-text-muted text-sm font-medium">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-white text-black py-4 rounded-2xl font-black text-lg hover:bg-white/90 transition-all shadow-xl"
          >
            RETRY CONNECTION
          </button>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-[100dvh] bg-background flex flex-col items-center justify-center p-4 text-center overflow-hidden relative">
        {/* Animated Background Blobs - Subtle */}
        <div className="absolute top-[-5%] left-[-5%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[100px] animate-pulse delay-700" />
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-sm w-full auth-card p-6 md:p-10 rounded-[3rem] space-y-6 md:space-y-8 relative z-10 border border-white/5 shadow-2xl"
        >
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase">Dibakar <span className="text-primary drop-shadow-[0_0_10px_rgba(0,255,150,0.2)]">AI</span></h1>
            <p className="text-text-muted text-sm md:text-base font-medium px-4">Experience the future of search with AI</p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-500 text-xs text-left flex flex-col gap-2"
            >
              <div className="flex items-center gap-2 font-bold">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                Authentication Error
              </div>
              <p className="opacity-80">{error}</p>
              <button 
                onClick={() => { setError(null); window.location.reload(); }}
                className="text-red-500 font-black uppercase tracking-widest mt-1 hover:underline"
              >
                Try Again
              </button>
            </motion.div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-white text-black py-4 rounded-2xl font-black text-lg hover:bg-white/90 transition-all shadow-xl flex items-center justify-center gap-3 group active:scale-95"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={20} />
                  CONTINUE WITH GOOGLE
                </>
              )}
            </button>

            <p className="text-[10px] text-text-muted font-bold uppercase tracking-[0.2em] pt-2">
              Secure • Fast • Private
            </p>
          </div>
          
          <div className="pt-6 border-t border-white/5">
            <p className="text-[10px] text-text-muted font-medium uppercase tracking-widest leading-relaxed opacity-60">
              By continuing, you agree to our <br />
              <span className="text-primary cursor-pointer hover:underline">Terms</span> & <span className="text-primary cursor-pointer hover:underline">Privacy</span>
            </p>
          </div>
        </motion.div>

        {/* Decorative Elements */}
        <div className="absolute top-10 right-10 w-32 h-32 border border-white/5 rounded-full animate-spin-slow pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-24 h-24 border border-white/5 rounded-full animate-reverse-spin pointer-events-none" />
      </div>
    );
  }

  const showPaywall = isAuthReady && ((user.credits <= 0 && user.role !== 'admin') || isPaywallOpen);

  return (
    <div className="h-[100dvh] min-h-[calc(var(--vh,1vh)*100)] bg-background flex flex-col overflow-hidden relative">
      {/* Global Background Decorative Elements - Subtle */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-5%] right-[-5%] w-[30%] h-[30%] bg-primary/2 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-secondary/2 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      <Toaster position="top-center" richColors />
      <AnimatePresence>
        {isHistoryOpen && (
          <Sidebar
            userId={user.uid}
            currentChatId={currentChatId}
            onSelectChat={(id) => { setCurrentChatId(id); setIsHistoryOpen(false); }}
            onNewChat={() => { setCurrentChatId(null); setIsHistoryOpen(false); }}
            isAdmin={user.role === 'admin'}
            onOpenAdmin={() => { setIsAdminOpen(true); setIsHistoryOpen(false); }}
            onClose={() => setIsHistoryOpen(false)}
          />
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 md:px-6 z-50 bg-surface/30 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsHistoryOpen(true)}
              className="p-2.5 hover:bg-surface-hover rounded-xl text-text-muted transition-all active:scale-90"
            >
              <History size={22} />
            </button>
            <div className="flex items-center gap-2 bg-surface/50 backdrop-blur-md px-4 py-2 rounded-2xl border border-border cursor-pointer hover:bg-surface-hover transition-all group">
              <span className="text-sm md:text-base font-bold tracking-tight">Dibakar <span className="text-primary drop-shadow-[0_0_8px_rgba(0,255,150,0.4)]">AI</span></span>
              <ChevronDown size={16} className="text-text-muted group-hover:text-text transition-colors" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-surface/50 backdrop-blur-md px-4 py-2 rounded-2xl border border-border">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                {user?.role === 'admin' ? 'Unlimited' : `${user?.credits || 0} Credits`}
              </span>
            </div>
            
            <div className="relative">
              <button
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className="w-10 h-10 bg-surface border border-border rounded-full flex items-center justify-center text-text-muted hover:text-primary hover:border-primary/50 transition-all active:scale-90"
              >
                <MoreVertical size={20} />
              </button>

              <AnimatePresence>
                {isMoreMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-transparent" 
                      onClick={() => setIsMoreMenuOpen(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-56 bg-surface border border-border rounded-2xl shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-border">
                        <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Profile</p>
                        <p className="text-sm font-bold truncate">{user?.name || user?.email || user?.phoneNumber || 'User'}</p>
                        <p className="text-[10px] text-primary font-bold mt-1 uppercase tracking-tighter">
                          {user?.role === 'admin' ? 'Administrator' : 'Free User'}
                        </p>
                      </div>

                      <div className="p-2 grid grid-cols-2 sm:grid-cols-1 gap-1">
                        <button
                          onClick={() => { setIsMoreMenuOpen(false); setIsHistoryOpen(true); }}
                          className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-hover rounded-xl transition-colors"
                        >
                          <History size={16} /> History
                        </button>

                        <button
                          onClick={() => { setIsMoreMenuOpen(false); setIsPaywallOpen(true); }}
                          className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-hover rounded-xl transition-colors"
                        >
                          <Zap size={16} /> Plans
                        </button>

                        <button
                          onClick={toggleTheme}
                          className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-hover rounded-xl transition-colors"
                        >
                          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                          Theme
                        </button>

                        <button
                          onClick={() => { setIsMoreMenuOpen(false); setIsFeedbackOpen(true); }}
                          className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-hover rounded-xl transition-colors"
                        >
                          <MessageSquarePlus size={16} /> Feedback
                        </button>

                        <button
                          onClick={() => { 
                            setIsMoreMenuOpen(false); 
                            window.location.href = 'tel:9475954278';
                          }}
                          className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-hover rounded-xl transition-colors"
                        >
                          <Phone size={16} /> Support
                        </button>
                        
                        {user.role === 'admin' && (
                          <button
                            onClick={() => { setIsAdminOpen(true); setIsMoreMenuOpen(false); }}
                            className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-hover rounded-xl transition-colors text-primary"
                          >
                            <LayoutDashboard size={16} /> Admin
                          </button>
                        )}

                        <button
                          onClick={handleLogout}
                          className="col-span-2 sm:col-span-1 flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-hover rounded-xl transition-colors text-red-500"
                        >
                          <LogOut size={16} /> Logout
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {showPaywall ? (
          <Paywall 
            user={user!}
            onClose={isPaywallOpen ? () => setIsPaywallOpen(false) : undefined} 
          />
        ) : (
          <>
            <ChatArea chatId={currentChatId} isSearching={isSearching} user={user} optimisticQuery={currentQuery} />
            <SearchBar onSearch={handleSearch} disabled={isSearching} chatId={currentChatId} />
          </>
        )}

        <AnimatePresence>
          {isAdminOpen && <AdminDashboard onClose={() => setIsAdminOpen(false)} />}
        </AnimatePresence>

        <AnimatePresence>
          {showPermissionPopup && (
            <PermissionPopup 
              onClose={() => {
                setShowPermissionPopup(false);
                localStorage.setItem('hasSeenPermissions', 'true');
              }} 
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isFeedbackOpen && user && (
            <FeedbackModal 
              user={user}
              onClose={() => setIsFeedbackOpen(false)} 
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
