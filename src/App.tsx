import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, serverTimestamp, updateDoc, increment, query, orderBy, limit, getDocs, getDocFromServer } from 'firebase/firestore';
import { auth, db, googleProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword } from './lib/firebase';
import { generateSearchResponse, generateChatTitle, generateSearchResponseStream } from './lib/geminiService';
import { UserProfile, Chat, Message, SearchResponse } from './types';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SearchBar from './components/SearchBar';
import AdminDashboard from './components/AdminDashboard';
import Paywall from './components/Paywall';
import PermissionPopup from './components/PermissionPopup';
import FeedbackModal from './components/FeedbackModal';
import { LogIn, LogOut, CreditCard, User, ShieldCheck, ShieldAlert, MoreVertical, History, LayoutDashboard, Phone, Zap, Sun, Moon, MessageSquarePlus, Mail, Lock, Eye, EyeOff, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { Toaster } from 'sonner';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
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

    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log('Firestore connection test successful');
      } catch (err: any) {
        console.warn('Firestore connection test failed:', err.message);
        if (err.message?.includes('the client is offline')) {
          console.warn('Firestore is offline. Proceeding with cached data if available.');
          // Don't set a blocking error for offline state
        } else if (err.message?.includes('PERMISSION_DENIED')) {
          console.warn('Permission denied for connection test. This is often normal if rules are strictly locked down.');
        }
      }
    }
    testConnection();

    let userUnsubscribe: (() => void) | null = null;

    console.log('Auth state listener initialized');
    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser ? `User logged in: ${firebaseUser.email || firebaseUser.uid}` : 'No user (logged out)');
      
      if (!firebaseUser) {
        console.log('Clearing user state...');
        setUser(null);
        setIsAuthReady(false);
        setLoading(false);
        return;
      }

      // Clean up previous user listener
      if (userUnsubscribe) {
        userUnsubscribe();
        userUnsubscribe = null;
      }

      // Set provisional user to prevent login loop while fetching profile
      console.log('Setting provisional user state...');
      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: firebaseUser.displayName || 'User',
        role: 'user',
        credits: 0,
        createdAt: new Date().toISOString()
      } as UserProfile);

      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        let userSnap;
        try {
          userSnap = await getDoc(userRef);
        } catch (err: any) {
          console.warn('Initial user profile fetch failed:', err.message);
          if (err.message?.includes('the client is offline')) {
            // If offline, we might still have data in cache or we'll get it via onSnapshot
            // We'll proceed and let onSnapshot handle the real-time updates
            console.log('Proceeding in offline mode...');
          } else {
            throw err; // Re-throw other errors
          }
        }

        if (userSnap) {
          if (!userSnap.exists()) {
            console.log('Creating new user document...');
            const isAdmin = 
              firebaseUser.email === "munshidipa62@gmail.com" || 
              firebaseUser.email === "munshidipa@gmail.com" || 
              firebaseUser.email === "dibakar61601@gmail.com" ||
              firebaseUser.phoneNumber === "+919475954278";

            const newUser: any = {
              uid: firebaseUser.uid,
              credits: isAdmin ? 999999 : 10,
              role: isAdmin ? 'admin' : 'user',
              createdAt: new Date().toISOString()
            };
            
            if (firebaseUser.email) newUser.email = firebaseUser.email;
            if (firebaseUser.phoneNumber) newUser.phoneNumber = firebaseUser.phoneNumber;
            
            await setDoc(userRef, newUser);
            console.log('New user document created.');
          } else {
            // Check if user should be admin but isn't yet
            const userData = userSnap.data();
            const shouldBeAdmin = 
              firebaseUser.email === "munshidipa62@gmail.com" || 
              firebaseUser.email === "munshidipa@gmail.com" || 
              firebaseUser.email === "dibakar61601@gmail.com" ||
              firebaseUser.phoneNumber === "+919475954278";
            
            if (shouldBeAdmin && userData.role !== 'admin') {
              await updateDoc(userRef, { role: 'admin', credits: 999999 });
            }
          }
        }

        // Real-time listener for credits and role
        userUnsubscribe = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            console.log('User profile updated from Firestore');
            const userData = doc.data() as UserProfile;
            setUser(userData);
            setIsAuthReady(true);
            setLoading(false);
          } else {
            // The creation logic above should have triggered, but we wait
            console.warn('User profile document does not exist yet');
            // We don't call setLoading(false) here yet, let the creation finish
            // or wait for the next snapshot
          }
        }, (err) => {
          console.error('Firestore snapshot error:', err);
          setError(`Firestore Error: ${err.message}`);
          setLoading(false);
        });
      } catch (err: any) {
        console.error('Error in auth state change handler:', err);
        setError(`Auth Handler Error: ${err.message}`);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(loadingTimeout);
      authUnsubscribe();
      if (userUnsubscribe) userUnsubscribe();
    };
  }, []);

  const [isPaywallOpen, setIsPaywallOpen] = useState(false);

  const handleLogin = async () => {
    console.log('Attempting login with Google...');
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('Login successful:', result.user.email);
      // We don't set loading to false here. 
      // The onAuthStateChanged listener will handle it once the profile is ready.
    } catch (error: any) {
      console.error('Login Error:', error.code, error.message);
      if (error.code === 'auth/unauthorized-domain') {
        setError(`Login failed: This domain is not authorized in Firebase. Please add your App URL to 'Authorized Domains' in the Firebase Console (Authentication > Settings).`);
      } else {
        setError(`Login failed: ${error.message}`);
      }
      setLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleSearch = async (queryText: string) => {
    if (!user || (user.credits <= 0 && user.role !== 'admin')) return;

    setIsSearching(true);
    let chatId = currentChatId;

    try {
      // 1. Create new chat if none selected
      if (!chatId) {
        const chatRef = await addDoc(collection(db, 'chats'), {
          userId: user.uid,
          title: queryText.slice(0, 40) + (queryText.length > 40 ? '...' : ''),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        chatId = chatRef.id;
        setCurrentChatId(chatId);
      } else {
        // Update existing chat's updatedAt
        await updateDoc(doc(db, 'chats', chatId), {
          updatedAt: new Date().toISOString()
        });
      }

      // 2. Add user message
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        role: 'user',
        content: queryText,
        createdAt: new Date().toISOString()
      });

      // 3. Get history for context
      const historySnap = await getDocs(query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(6) // Get 6 to skip the current user message if needed
      ));
      const history = historySnap.docs
        .map(doc => doc.data())
        .filter(m => m.content !== 'Thinking...') // Don't include the placeholder
        .reverse();

      // 4. Call Search API (Backend with Groq/Serper)
      const assistantMsgRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        role: 'assistant',
        content: 'Thinking...',
        sources: [],
        createdAt: new Date().toISOString()
      });

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText, history: history.slice(-5) })
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${text.slice(0, 100)}...`);
      }

      if (!response.ok) throw new Error(data.error || 'Search failed');

      if (assistantMsgRef) {
        await updateDoc(assistantMsgRef, {
          content: data.answer,
          sources: data.sources || []
        });
      }

      // 6. Generate a better title if it's a new chat
      if (!currentChatId) {
        generateChatTitle(queryText).then(newTitle => {
          if (chatId) {
            updateDoc(doc(db, 'chats', chatId), { title: newTitle }).catch(e => console.error('Title update error:', e));
          }
        }).catch(e => console.error('Title generation error:', e));
      }

      // 7. Deduct credit if not admin
      if (user && user.uid && user.role !== 'admin') {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            credits: increment(-1)
          });
        } catch (creditErr) {
          console.error('Failed to deduct credits:', creditErr);
        }
      }

    } catch (error: any) {
      console.error('Search Error:', error);
      // If we have a message reference, update it with the error
      if (chatId) {
        try {
          const messagesSnap = await getDocs(query(
            collection(db, 'chats', chatId, 'messages'),
            orderBy('createdAt', 'desc'),
            limit(1)
          ));
          
          const lastMsg = messagesSnap.docs[0];
          if (lastMsg && lastMsg.data().role === 'assistant') {
            await updateDoc(lastMsg.ref, {
              content: `Error: ${error.message || 'Something went wrong. Please try again later.'}`
            });
          }
        } catch (updateErr) {
          console.error('Failed to update error message in chat:', updateErr);
        }
      }
    } finally {
      setIsSearching(false);
    }
  };

  if (loading && !error) {
    return (
      <div className="h-[100dvh] bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-primary font-medium animate-pulse">Loading Dibakar AI...</p>
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
        {/* Animated Background Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-accent/20 rounded-full blur-[120px] animate-pulse delay-700" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-sm w-full auth-card p-fluid rounded-[3rem] space-y-fluid relative z-10 border border-white/10 shadow-2xl"
        >
          <div className="space-y-2">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
              <ShieldCheck className="text-primary" size={32} />
            </div>
            <h1 className="text-fluid-2xl font-black tracking-tighter text-white">SIGN UP</h1>
            <p className="text-text-muted text-fluid-sm font-medium px-4">Join Dibakar AI to experience the future of search</p>
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
    <div className="h-[100dvh] min-h-[calc(var(--vh,1vh)*100)] bg-background flex flex-col overflow-hidden">
      <Toaster position="top-center" richColors />
      <AnimatePresence>
        {isHistoryOpen && (
          <Sidebar
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
        <header className={`h-14 border-b border-border flex items-center justify-between px-3 md:px-6 bg-background/80 backdrop-blur-xl sticky top-0 transition-all ${isMoreMenuOpen ? 'z-[100]' : 'z-10'}`}>
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => setIsHistoryOpen(true)}
              className="p-2 hover:bg-surface-hover rounded-xl text-text-muted md:hidden active:scale-90 transition-transform"
            >
              <History size={20} />
            </button>
            <h1 className="text-lg md:text-xl font-black text-primary tracking-tighter">Dibakar AI</h1>
            <div className="flex items-center gap-1.5 md:gap-2 bg-surface px-2 md:px-3 py-1 md:py-1.5 rounded-full border border-border shadow-sm">
              <Zap size={12} className="text-primary" />
              <span className="text-[10px] md:text-sm font-black uppercase tracking-tighter">
                {user?.role === 'admin' ? 'Unlimited' : `${user?.credits || 0} Cr`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm text-text-muted">
              <User size={16} />
              <span className="hidden md:inline">{user?.name || user?.email || user?.phoneNumber || 'User'}</span>
            </div>
            
            <div className="relative">
              <button
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className="p-2 hover:bg-surface-hover rounded-full text-text-muted hover:text-white transition-colors"
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
          <Paywall onClose={isPaywallOpen ? () => setIsPaywallOpen(false) : undefined} />
        ) : (
          <>
            <ChatArea chatId={currentChatId} isSearching={isSearching} />
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
          {isFeedbackOpen && <FeedbackModal onClose={() => setIsFeedbackOpen(false)} />}
        </AnimatePresence>
      </main>
    </div>
  );
}
