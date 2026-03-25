import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, serverTimestamp, updateDoc, increment, query, orderBy, limit, getDocs, getDocFromServer } from 'firebase/firestore';
import { auth, db, googleProvider } from './lib/firebase';
import { generateSearchResponse, generateChatTitle, generateSearchResponseStream } from './lib/geminiService';
import { UserProfile, Chat, Message, SearchResponse } from './types';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SearchBar from './components/SearchBar';
import AdminDashboard from './components/AdminDashboard';
import Paywall from './components/Paywall';
import PermissionPopup from './components/PermissionPopup';
import FeedbackModal from './components/FeedbackModal';
import { LogIn, LogOut, CreditCard, User, ShieldCheck, MoreVertical, History, LayoutDashboard, Phone, Zap, Sun, Moon, MessageSquarePlus } from 'lucide-react';
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
  const [showPhoneLogin, setShowPhoneLogin] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const [error, setError] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showPermissionPopup, setShowPermissionPopup] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsDarkMode(false);
      document.documentElement.classList.add('light');
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
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log('Firestore connection test successful');
      } catch (err: any) {
        if (err.message?.includes('the client is offline')) {
          setError('Firestore is offline. Please check your Firebase configuration or internet connection.');
        }
      }
    }
    testConnection();

    console.log('Auth state listener initialized');
    return onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser ? 'User logged in' : 'No user');
      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            console.log('Creating new user document...');
            const isAdmin = 
              firebaseUser.email === "munshidipa62@gmail.com" || 
              firebaseUser.email === "dibakar61601@gmail.com" ||
              firebaseUser.phoneNumber === "+919242959903";

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
              firebaseUser.email === "dibakar61601@gmail.com" ||
              firebaseUser.phoneNumber === "+919242959903";
            
            if (shouldBeAdmin && userData.role !== 'admin') {
              await updateDoc(userRef, { role: 'admin', credits: 999999 });
            }
          }

          // Real-time listener for credits and role
          onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
              console.log('User profile updated from Firestore');
              setUser(doc.data() as UserProfile);
              setIsAuthReady(true);
              setLoading(false);
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
      } else {
        setUser(null);
        setIsAuthReady(false);
        setLoading(false);
      }
    });
  }, []);

  const [isPaywallOpen, setIsPaywallOpen] = useState(false);

  const handleLogin = async () => {
    console.log('Attempting login with Google...');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('Login successful:', result.user.email);
    } catch (error: any) {
      console.error('Login Error:', error.code, error.message);
      alert(`Login failed: ${error.message}`);
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible'
      });
      const result = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      setConfirmationResult(result);
    } catch (err: any) {
      console.error('Phone Login Error:', err);
      setError(`Phone Login Error: ${err.message}`);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await confirmationResult.confirm(verificationCode);
    } catch (err: any) {
      console.error('Verify Code Error:', err);
      setError(`Verify Code Error: ${err.message}`);
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
        limit(5)
      ));
      const history = historySnap.docs.map(doc => doc.data()).reverse();

      // 4. Call Search API (Gemini in Frontend with Streaming)
      const assistantMsgRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        role: 'assistant',
        content: '',
        sources: [],
        createdAt: new Date().toISOString()
      });

      const stream = generateSearchResponseStream(queryText, history);
      let lastUpdate = Date.now();
      
      for await (const chunk of stream) {
        // Update UI/DB every 200ms or when done to avoid too many writes
        if (Date.now() - lastUpdate > 200 || chunk.done) {
          await updateDoc(assistantMsgRef, {
            content: chunk.text,
            sources: chunk.sources
          });
          lastUpdate = Date.now();
        }
      }

      // 6. Generate a better title if it's a new chat
      if (!currentChatId) {
        generateChatTitle(queryText).then(newTitle => {
          if (chatId) {
            updateDoc(doc(db, 'chats', chatId), { title: newTitle });
          }
        });
      }

      // 7. Deduct credit if not admin
      if (user.role !== 'admin') {
        await updateDoc(doc(db, 'users', user.uid), {
          credits: increment(-1)
        });
      }

      // 7. Increment global stats
      await updateDoc(doc(db, 'stats', 'global'), {
        totalRequests: increment(1)
      }).catch(async () => {
        // Create if doesn't exist
        await setDoc(doc(db, 'stats', 'global'), { totalRequests: 1 });
      });

    } catch (error) {
      console.error('Search Error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass p-10 rounded-3xl space-y-8"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto">
            <ShieldCheck className="text-primary" size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Dibakar AI</h1>
            <p className="text-text-muted">Welcome to the future of AI Search. Sign up or login to continue.</p>
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-xl text-red-500 text-xs mt-4 flex flex-col gap-2">
                <span>{error}</span>
                <button 
                  onClick={() => { setError(null); setLoading(true); window.location.reload(); }}
                  className="underline font-bold text-left"
                >
                  Click here to Retry
                </button>
              </div>
            )}
          </div>
          <div className="space-y-4">
            {!showPhoneLogin ? (
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleLogin}
                  className="w-full bg-white text-black hover:bg-gray-200 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all"
                >
                  <LogIn size={20} /> Continue with Google
                </button>
                <div className="flex items-center gap-4 my-2">
                  <div className="h-px bg-border flex-1" />
                  <span className="text-[10px] text-text-muted uppercase tracking-widest">OR</span>
                  <div className="h-px bg-border flex-1" />
                </div>
                <button
                  onClick={() => setShowPhoneLogin(true)}
                  className="w-full bg-surface-hover border border-border hover:border-primary py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all"
                >
                  Sign in with Phone
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-bold">Phone Login</h3>
                {!confirmationResult ? (
                  <form onSubmit={handlePhoneLogin} className="space-y-4">
                    <input
                      type="tel"
                      placeholder="+91 1234567890"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl py-3 px-4 focus:ring-2 ring-primary/50 outline-none"
                      required
                    />
                    <button
                      type="submit"
                      className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-blue-600 transition-all"
                    >
                      Send OTP
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPhoneLogin(false)}
                      className="w-full text-xs text-text-muted hover:text-white"
                    >
                      Back to Google Login
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyCode} className="space-y-4">
                    <input
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl py-3 px-4 focus:ring-2 ring-primary/50 outline-none"
                      required
                    />
                    <button
                      type="submit"
                      className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-blue-600 transition-all"
                    >
                      Verify OTP
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmationResult(null)}
                      className="w-full text-xs text-text-muted hover:text-white"
                    >
                      Resend OTP
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
          
          <div id="recaptcha-container"></div>
          
          <div className="pt-4">
            <a 
              href={window.location.href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Having trouble? Open in a new tab
            </a>
          </div>
          <p className="text-[10px] text-text-muted uppercase tracking-widest">
            Secure Authentication by Firebase
          </p>
        </motion.div>
      </div>
    );
  }

  const showPaywall = (user.credits <= 0 && user.role !== 'admin') || isPaywallOpen;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
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
        <header className="h-16 border-b border-border flex items-center justify-between px-4 md:px-6 bg-background/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-primary md:hidden">Dibakar AI</h1>
            <div className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-full border border-border">
              <CreditCard size={14} className="text-primary" />
              <span className="text-xs md:text-sm font-bold">
                {user.role === 'admin' ? 'Unlimited' : `${user.credits} Credits`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <User size={16} />
              <span className="hidden md:inline">{user.email || user.phoneNumber}</span>
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
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsMoreMenuOpen(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-border">
                        <p className="text-xs text-text-muted uppercase tracking-widest mb-1">Profile</p>
                        <p className="text-sm font-bold truncate">{user.email || user.phoneNumber}</p>
                        <p className="text-[10px] text-primary font-bold mt-1 uppercase tracking-tighter">
                          {user.role === 'admin' ? 'Administrator' : 'Free User'}
                        </p>
                      </div>

                      <div className="p-2">
                        <button
                          onClick={() => { setIsMoreMenuOpen(false); setIsHistoryOpen(true); }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-hover rounded-lg transition-colors"
                        >
                          <History size={16} /> History
                        </button>

                        <button
                          onClick={() => { setIsMoreMenuOpen(false); setIsPaywallOpen(true); }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-hover rounded-lg transition-colors"
                        >
                          <Zap size={16} /> Subscription Plan
                        </button>

                        <button
                          onClick={toggleTheme}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-hover rounded-lg transition-colors"
                        >
                          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                          {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                        </button>

                        <button
                          onClick={() => { setIsMoreMenuOpen(false); setIsFeedbackOpen(true); }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-hover rounded-lg transition-colors"
                        >
                          <MessageSquarePlus size={16} /> Feedback
                        </button>

                        <button
                          onClick={() => { 
                            setIsMoreMenuOpen(false); 
                            window.location.href = 'tel:9242959903';
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-hover rounded-lg transition-colors"
                        >
                          <Phone size={16} /> Customer Care
                        </button>
                        
                        {user.role === 'admin' && (
                          <button
                            onClick={() => { setIsAdminOpen(true); setIsMoreMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-hover rounded-lg transition-colors text-primary"
                          >
                            <LayoutDashboard size={16} /> Admin Dashboard
                          </button>
                        )}

                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-hover rounded-lg transition-colors text-red-500"
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
