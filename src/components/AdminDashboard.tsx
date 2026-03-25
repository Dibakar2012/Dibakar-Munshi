import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, increment, getDoc, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Chat } from '../types';
import { Search, User, CreditCard, Calendar, X, PlusCircle, TrendingUp, Users, Zap, ShoppingBag, BarChart3, ArrowUpRight, Activity, LayoutDashboard, RefreshCw, CheckCircle2, AlertCircle, Star, MessageSquarePlus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { format, subDays, startOfDay, isAfter } from 'date-fns';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface AdminDashboardProps {
  onClose: () => void;
}

interface Stats {
  totalUsers: number;
  totalRequests: number;
  premiumUsers: number;
  activeToday: number;
  plan35Count: number;
  plan99Count: number;
  premiumPercentage: number;
  totalChats: number;
  growthData: { date: string; count: number }[];
  feedbackStats: {
    averageRating: number;
    totalFeedbacks: number;
    ratingCounts: { [key: number]: number };
  };
}

interface Feedback {
  id: string;
  userId: string;
  userEmail: string;
  rating: number;
  comment: string;
  createdAt: any;
}

export default function AdminDashboard({ onClose }: AdminDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [foundUsers, setFoundUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [injectingId, setInjectingId] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    setFeedbacksLoading(true);
    try {
      const q = query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      setFeedbacks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Feedback)));
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    } finally {
      setFeedbacksLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      // 1. Fetch Global Requests
      const globalSnap = await getDoc(doc(db, 'stats', 'global'));
      const totalRequests = globalSnap.exists() ? globalSnap.data().totalRequests : 0;

      // 2. Fetch All Users (for stats)
      const usersSnap = await getDocs(collection(db, 'users'));
      const allUsers = usersSnap.docs.map(doc => doc.data() as UserProfile);
      
      const totalUsers = allUsers.length;
      const now = new Date();
      
      const premiumUsers = allUsers.filter(u => u.planExpiry && isAfter(new Date(u.planExpiry), now)).length;
      const plan35Count = allUsers.filter(u => u.planType === '35').length;
      const plan99Count = allUsers.filter(u => u.planType === '99').length;
      const premiumPercentage = totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0;

      // 3. Total Chats
      const chatsSnap = await getDocs(collection(db, 'chats'));
      const totalChats = chatsSnap.size;

      // 4. Active Today (Users with chats updated in last 24h)
      const last24h = subDays(now, 1).toISOString();
      const activeChatsSnap = await getDocs(query(collection(db, 'chats'), where('updatedAt', '>=', last24h)));
      const activeUserIds = new Set(activeChatsSnap.docs.map(doc => doc.data().userId));
      const activeToday = activeUserIds.size;

      // 5. Growth Data (Last 7 days)
      const growthMap: { [key: string]: number } = {};
      for (let i = 6; i >= 0; i--) {
        const dateStr = format(subDays(now, i), 'MMM dd');
        growthMap[dateStr] = 0;
      }

      allUsers.forEach(u => {
        if (u.createdAt) {
          const dateStr = format(new Date(u.createdAt), 'MMM dd');
          if (growthMap[dateStr] !== undefined) {
            growthMap[dateStr]++;
          }
        }
      });

      const growthData = Object.entries(growthMap).map(([date, count]) => ({ date, count }));

      // 6. Feedback Stats
      const feedbackSnap = await getDocs(collection(db, 'feedbacks'));
      const allFeedbacks = feedbackSnap.docs.map(doc => doc.data());
      const totalFeedbacks = allFeedbacks.length;
      const ratingCounts: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let sumRating = 0;

      allFeedbacks.forEach(f => {
        ratingCounts[f.rating]++;
        sumRating += f.rating;
      });

      const averageRating = totalFeedbacks > 0 ? Number((sumRating / totalFeedbacks).toFixed(1)) : 0;

      setStats({
        totalUsers,
        totalRequests,
        premiumUsers,
        activeToday,
        plan35Count,
        plan99Count,
        premiumPercentage,
        totalChats,
        growthData,
        feedbackStats: {
          averageRating,
          totalFeedbacks,
          ratingCounts
        }
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Failed to load dashboard stats');
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      const qEmail = query(collection(db, 'users'), where('email', '==', searchTerm.trim()));
      const qPhone = query(collection(db, 'users'), where('phoneNumber', '==', searchTerm.trim()));
      
      const [snapEmail, snapPhone] = await Promise.all([getDocs(qEmail), getDocs(qPhone)]);
      
      const users: UserProfile[] = [];
      snapEmail.forEach(doc => users.push({ ...doc.data() } as UserProfile));
      snapPhone.forEach(doc => {
        if (!users.find(u => u.uid === doc.id)) {
          users.push({ ...doc.data() } as UserProfile);
        }
      });

      setFoundUsers(users);
      if (users.length === 0) {
        toast.info('No user found matching that email or phone');
      }
    } catch (error) {
      console.error('Admin Search Error:', error);
      toast.error('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const injectCredits = async (uid: string, amount: number, planType?: '35' | '99') => {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid positive number');
      return;
    }
    
    setInjectingId(uid);
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      const updateData: any = {
        credits: increment(numAmount),
        planExpiry: expiryDate.toISOString()
      };

      if (planType) {
        updateData.planType = planType;
      }

      await updateDoc(doc(db, 'users', uid), updateData);

      setFoundUsers(prev => prev.map(u => 
        u.uid === uid ? { ...u, credits: u.credits + numAmount, planExpiry: expiryDate.toISOString(), planType: planType || u.planType } : u
      ));
      
      setCustomAmount('');
      toast.success(`Successfully added ${numAmount} credits to user!`);
      fetchStats(); // Refresh stats after update
    } catch (error) {
      console.error('Injection Error:', error);
      toast.error('Failed to add credits. Check your connection.');
    } finally {
      setInjectingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0a0a0a] border border-white/10 w-full max-w-6xl h-[92vh] rounded-[2.5rem] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(59,130,246,0.1)]"
      >
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-b from-white/5 to-transparent">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
              <LayoutDashboard className="text-primary" size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter uppercase">Mission Control</h2>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <p className="text-[10px] text-white/40 font-mono uppercase tracking-[0.2em]">System Status: Operational</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={fetchStats}
              className="p-3 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/10"
              title="Refresh Stats"
            >
              <RefreshCw size={20} className={cn(statsLoading && "animate-spin")} />
            </button>
            <button 
              onClick={onClose} 
              className="p-3 hover:bg-red-500/10 hover:text-red-500 rounded-2xl transition-all border border-transparent hover:border-red-500/20"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          {/* Stats Grid */}
          {statsLoading && !stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-36 bg-white/5 animate-pulse rounded-[2rem] border border-white/5" />
              ))}
            </div>
          ) : stats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <StatCard 
                  label="Total Requests" 
                  value={stats.totalRequests.toLocaleString()} 
                  icon={<Activity className="text-blue-400" size={20} />} 
                  sub="Global AI usage"
                />
                <StatCard 
                  label="Total Users" 
                  value={stats.totalUsers.toLocaleString()} 
                  icon={<Users className="text-purple-400" size={20} />} 
                  sub="Registered accounts"
                />
                <StatCard 
                  label="Active Today" 
                  value={stats.activeToday.toLocaleString()} 
                  icon={<TrendingUp className="text-green-400" size={20} />} 
                  sub="Unique daily users"
                />
                <StatCard 
                  label="Total Chats" 
                  value={stats.totalChats.toLocaleString()} 
                  icon={<Zap className="text-yellow-400" size={20} />} 
                  sub="Conversations started"
                />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden group">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <BarChart3 size={20} className="text-primary" /> User Acquisition
                      </h3>
                      <p className="text-xs text-white/40">New registrations over the last 7 days</p>
                    </div>
                    <div className="px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-bold text-primary uppercase tracking-widest">
                      Live Growth
                    </div>
                  </div>
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.growthData}>
                        <defs>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#ffffff20" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                          dy={10}
                        />
                        <YAxis 
                          stroke="#ffffff20" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                          dx={-10}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#0f0f0f', 
                            border: '1px solid rgba(255,255,255,0.1)', 
                            borderRadius: '16px',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                          }}
                          itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                          cursor={{ stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '5 5' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="count" 
                          stroke="#3b82f6" 
                          fillOpacity={1} 
                          fill="url(#colorCount)" 
                          strokeWidth={4} 
                          animationDuration={2000}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex flex-col">
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-8">
                    <ShoppingBag size={20} className="text-primary" /> Revenue Mix
                  </h3>
                  <div className="space-y-8 flex-1 flex flex-col justify-center">
                    <PlanStat label="₹35 Starter" count={stats.plan35Count} total={stats.totalUsers} color="bg-blue-500" icon={<Zap size={12} />} />
                    <PlanStat label="₹99 Pro" count={stats.plan99Count} total={stats.totalUsers} color="bg-purple-500" icon={<Zap size={12} />} />
                    <PlanStat label="Free Tier" count={stats.totalUsers - stats.premiumUsers} total={stats.totalUsers} color="bg-white/20" icon={<User size={12} />} />
                    
                    <div className="mt-4 pt-6 border-t border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-white/40 font-bold uppercase tracking-widest">Conversion Rate</span>
                        <span className="text-xl font-black text-primary">{stats.premiumPercentage}%</span>
                      </div>
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${stats.premiumPercentage}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feedback Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex flex-col">
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-8">
                    <Star size={20} className="text-yellow-400" /> User Satisfaction
                  </h3>
                  <div className="flex flex-col items-center justify-center mb-8">
                    <div className="text-6xl font-black text-white tracking-tighter">{stats.feedbackStats.averageRating}</div>
                    <div className="flex gap-1 mt-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star 
                          key={s} 
                          size={16} 
                          className={cn(
                            "transition-colors",
                            s <= Math.round(stats.feedbackStats.averageRating) ? "fill-yellow-400 text-yellow-400" : "text-white/10"
                          )} 
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-4">Based on {stats.feedbackStats.totalFeedbacks} reviews</p>
                  </div>
                  <div className="space-y-4 flex-1">
                    {[5, 4, 3, 2, 1].map((rating) => {
                      const count = stats.feedbackStats.ratingCounts[rating] || 0;
                      const percentage = stats.feedbackStats.totalFeedbacks > 0 ? (count / stats.feedbackStats.totalFeedbacks) * 100 : 0;
                      return (
                        <div key={rating} className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-white/40 w-4">{rating}★</span>
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              className="h-full bg-yellow-400"
                            />
                          </div>
                          <span className="text-[10px] font-mono text-white/40 w-8 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <MessageSquarePlus size={20} className="text-primary" /> Recent Feedback
                    </h3>
                    <button 
                      onClick={fetchFeedbacks}
                      className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
                    >
                      Refresh List
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar max-h-[400px]">
                    {feedbacksLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="animate-spin text-primary" />
                      </div>
                    ) : feedbacks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-white/20">
                        <MessageSquarePlus size={48} className="mb-4 opacity-10" />
                        <p className="text-sm font-bold uppercase tracking-widest">No feedback received yet</p>
                      </div>
                    ) : (
                      feedbacks.map((f) => (
                        <div key={f.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.04] transition-all">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star 
                                    key={s} 
                                    size={10} 
                                    className={cn(s <= f.rating ? "fill-yellow-400 text-yellow-400" : "text-white/10")} 
                                  />
                                ))}
                              </div>
                              <span className="text-[10px] font-bold text-white/60">{f.userEmail || 'Anonymous'}</span>
                            </div>
                            <span className="text-[9px] font-mono text-white/20">
                              {f.createdAt ? format(f.createdAt.toDate(), 'MMM dd, HH:mm') : 'Just now'}
                            </span>
                          </div>
                          {f.comment && (
                            <p className="text-xs text-white/80 leading-relaxed italic">"{f.comment}"</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* User Management */}
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-black tracking-tighter uppercase">User Management</h3>
                <p className="text-xs text-white/40">Search and modify user credits manually</p>
              </div>
              <form onSubmit={handleSearch} className="relative w-full max-w-xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={20} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Enter user email or phone number..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-32 focus:ring-2 ring-primary/50 outline-none text-sm transition-all focus:bg-white/10"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary hover:bg-blue-600 disabled:opacity-50 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                >
                  {loading ? <RefreshCw size={16} className="animate-spin" /> : 'Search'}
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <AnimatePresence mode="popLayout">
                {foundUsers.map(user => (
                  <motion.div 
                    key={user.uid}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white/5 border border-white/10 p-6 rounded-[2rem] space-y-6 hover:border-primary/40 transition-all group relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/20 transition-all">
                          <User size={32} className="text-white/20 group-hover:text-primary/40 transition-all" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg truncate max-w-[200px]">{user.email || user.phoneNumber}</h4>
                          <p className="text-[10px] text-white/20 font-mono tracking-tighter">ID: {user.uid}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={cn(
                              "text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest",
                              user.role === 'admin' ? "bg-primary/20 text-primary" : "bg-white/10 text-white/40"
                            )}>
                              {user.role}
                            </span>
                            {user.planType && (
                              <span className="text-[9px] font-black px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-500 uppercase tracking-widest">
                                ₹{user.planType} Plan
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black text-primary tracking-tighter flex items-center justify-end gap-2">
                          <CreditCard size={24} className="opacity-40" /> {user.credits}
                        </div>
                        <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mt-1">Available Credits</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Quick Inject</p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => injectCredits(user.uid, 75, '35')} 
                            disabled={injectingId === user.uid}
                            className="flex-1 bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-primary/10 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                          >
                            {injectingId === user.uid ? <RefreshCw size={14} className="animate-spin" /> : <><PlusCircle size={14} /> ₹35 (75)</>}
                          </button>
                          <button 
                            onClick={() => injectCredits(user.uid, 300, '99')} 
                            disabled={injectingId === user.uid}
                            className="flex-1 bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-primary/10 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                          >
                            {injectingId === user.uid ? <RefreshCw size={14} className="animate-spin" /> : <><PlusCircle size={14} /> ₹99 (300)</>}
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Manual Override</p>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            placeholder="Enter credits..."
                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 ring-primary/50 transition-all"
                          />
                          <button
                            onClick={() => injectCredits(user.uid, Number(customAmount))}
                            disabled={!customAmount || Number(customAmount) <= 0 || injectingId === user.uid}
                            className="bg-white text-black hover:bg-primary hover:text-white disabled:opacity-20 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                          >
                            {injectingId === user.uid ? <RefreshCw size={14} className="animate-spin" /> : 'Add'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Background Glow Decor */}
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all" />
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {foundUsers.length === 0 && !loading && searchTerm && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full py-20 text-center space-y-4 bg-white/[0.02] rounded-[3rem] border border-dashed border-white/10"
                >
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle size={32} className="text-white/20" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold">No results found</h4>
                    <p className="text-sm text-white/40">We couldn't find any users matching "{searchTerm}"</p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ label, value, icon, sub }: { label: string; value: string; icon: React.ReactNode; sub: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white/5 border border-white/10 p-7 rounded-[2rem] space-y-4 relative overflow-hidden group transition-all hover:bg-white/[0.07] hover:border-white/20"
    >
      <div className="flex items-center justify-between">
        <div className="p-3 bg-black/40 rounded-2xl border border-white/5 group-hover:border-primary/30 transition-all">{icon}</div>
        <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center">
          <ArrowUpRight size={14} className="text-primary opacity-40 group-hover:opacity-100 transition-all" />
        </div>
      </div>
      <div>
        <p className="text-3xl font-black tracking-tighter">{value}</p>
        <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black mt-1">{label}</p>
        <p className="text-[9px] text-white/20 font-medium mt-2">{sub}</p>
      </div>
      
      {/* Decorative line */}
      <div className="absolute bottom-0 left-0 w-0 h-1 bg-primary group-hover:w-full transition-all duration-500" />
    </motion.div>
  );
}

function PlanStat({ label, count, total, color, icon }: { label: string; count: number; total: number; color: string; icon: React.ReactNode }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-lg bg-white/5", color.replace('bg-', 'text-'))}>{icon}</div>
          <span className="text-xs font-black uppercase tracking-widest">{label}</span>
        </div>
        <span className="text-[10px] font-mono text-white/40">{count} users • {Math.round(percentage)}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden p-[2px] border border-white/5">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className={cn("h-full rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]", color)}
        />
      </div>
    </div>
  );
}
