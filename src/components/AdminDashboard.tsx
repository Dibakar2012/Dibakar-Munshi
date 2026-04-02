import React, { useState, useEffect } from 'react';
import { UserProfile, Chat, PremiumRequest } from '../types';
import { Search, User, CreditCard, Calendar, X, PlusCircle, TrendingUp, Users, Zap, ShoppingBag, BarChart3, ArrowUpRight, Activity, LayoutDashboard, RefreshCw, CheckCircle2, AlertCircle, Star, MessageSquarePlus, Loader2, MoreVertical, Check, Trash2, Shield, ShieldAlert, ExternalLink, Mail, Phone, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
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
  todayLlamaTokens: number;
  todaySerperRequests: number;
  globalLlamaTokens: number;
  globalSerperRequests: number;
  usageData: { date: string; llamaTokens: number; serperRequests: number }[];
  requestsData: { date: string; count: number }[];
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
  const [premiumRequests, setPremiumRequests] = useState<PremiumRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    fetchFeedbacks();
    fetchPremiumRequests();
  }, []);

  const fetchPremiumRequests = async () => {
    setRequestsLoading(true);
    try {
      const response = await fetch('/api/premium-requests');
      const documents = await response.json();
      setPremiumRequests(documents.map((doc: any) => ({ 
        id: doc.$id, 
        ...doc,
        createdAt: doc.$createdAt 
      } as unknown as PremiumRequest)));
    } catch (error) {
      console.error('Error fetching premium requests:', error);
    } finally {
      setRequestsLoading(false);
    }
  };

  const updateRequestStatus = async (requestId: string, status: 'completed' | 'rejected') => {
    try {
      const request = premiumRequests.find(req => req.id === requestId);
      if (!request) return;

      await fetch(`/api/premium-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (status === 'completed') {
        const creditsToAdd = request.plan.includes('35') ? 70 : request.plan.includes('99') ? 300 : 0;
        if (creditsToAdd > 0) {
          const userRes = await fetch(`/api/users/${request.userId}`);
          const userDoc = await userRes.json();
          
          await fetch(`/api/users/${request.userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              credits: (userDoc.credits || 0) + creditsToAdd,
              planType: request.plan.includes('35') ? 'starter' : 'pro',
              planExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            })
          });
          toast.success(`Injected ${creditsToAdd} credits to user.`);
        }
      }

      setPremiumRequests(prev => prev.map(req => req.id === requestId ? { ...req, status } : req));
      toast.success(`Request marked as ${status}`);
    } catch (error) {
      console.error('Error updating request status:', error);
      toast.error('Failed to update status');
    }
  };

  const deleteUser = async (uid: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This action is irreversible.')) return;
    try {
      await fetch(`/api/users/${uid}`, { method: 'DELETE' });
      setFoundUsers(prev => prev.filter(u => u.uid !== uid));
      toast.success('User deleted successfully');
      fetchStats();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const toggleAdmin = async (user: UserProfile) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await fetch(`/api/users/${user.uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      setFoundUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, role: newRole } : u));
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const fetchFeedbacks = async () => {
    setFeedbacksLoading(true);
    try {
      const response = await fetch('/api/feedback');
      const documents = await response.json();
      setFeedbacks(documents.map((doc: any) => ({ 
        id: doc.$id, 
        ...doc,
        createdAt: doc.$createdAt 
      } as unknown as Feedback)));
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    } finally {
      setFeedbacksLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();

      const globalData = data.global || {};
      const dailyData = data.daily || {};
      const allUsers = data.users.map((doc: any) => ({ ...doc, uid: doc.$id } as unknown as UserProfile));
      const allFeedbacks = data.feedbacks || [];

      const totalRequests = globalData.totalRequests || 0;
      const globalLlamaTokens = globalData.llamaTokens || 0;
      const globalSerperRequests = globalData.serperRequests || 0;
      
      const todayLlamaTokens = dailyData.llamaTokens || 0;
      const todaySerperRequests = dailyData.serperRequests || 0;

      const totalUsers = allUsers.length;
      const now = new Date();
      
      const premiumUsers = allUsers.filter(u => u.planExpiry && isAfter(new Date(u.planExpiry), now)).length;
      const plan35Count = allUsers.filter(u => u.planType === '35').length;
      const plan99Count = allUsers.filter(u => u.planType === '99').length;
      const premiumPercentage = totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0;

      const totalChats = data.totalChats;

      // Growth Data
      const growthMap: { [key: string]: number } = {};
      for (let i = 6; i >= 0; i--) {
        const dateStr = format(subDays(now, i), 'MMM dd');
        growthMap[dateStr] = 0;
      }
      allUsers.forEach(u => {
        if (u.createdAt) {
          try {
            const date = new Date(u.createdAt);
            const dateStr = format(date, 'MMM dd');
            if (growthMap[dateStr] !== undefined) growthMap[dateStr]++;
          } catch (e) {}
        }
      });
      const growthData = Object.entries(growthMap).map(([date, count]) => ({ date, count }));

      // Usage Data (mocking for now as we don't have historical daily docs easily accessible in one fetch)
      // In a real app, we'd fetch the last 7 daily docs.
      const usageData = [{ date: format(now, 'MMM dd'), llamaTokens: todayLlamaTokens, serperRequests: todaySerperRequests, totalRequests: dailyData.totalRequests || 0 }];
      const requestsData = usageData.map(d => ({ date: d.date, count: d.totalRequests }));

      // Feedback Stats
      const totalFeedbacks = allFeedbacks.length;
      const ratingCounts: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let sumRating = 0;
      allFeedbacks.forEach((f: any) => {
        ratingCounts[f.rating]++;
        sumRating += f.rating;
      });
      const averageRating = totalFeedbacks > 0 ? Number((sumRating / totalFeedbacks).toFixed(1)) : 0;

      setStats({
        totalUsers,
        totalRequests,
        premiumUsers,
        activeToday: 0, // Simplified
        plan35Count,
        plan99Count,
        premiumPercentage,
        totalChats,
        growthData,
        feedbackStats: { averageRating, totalFeedbacks, ratingCounts },
        todayLlamaTokens,
        todaySerperRequests,
        globalLlamaTokens,
        globalSerperRequests,
        usageData,
        requestsData
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
      const response = await fetch(`/api/users/search?term=${encodeURIComponent(searchTerm.trim())}`);
      const documents = await response.json();
      const users = documents.map((doc: any) => ({ ...doc, uid: doc.$id } as unknown as UserProfile));

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

      const userRes = await fetch(`/api/users/${uid}`);
      const userDoc = await userRes.json();

      const updateData: any = {
        credits: (userDoc.credits || 0) + numAmount,
        planExpiry: expiryDate.toISOString()
      };
      if (planType) updateData.planType = planType;

      await fetch(`/api/users/${uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      setFoundUsers(prev => prev.map(u => 
        u.uid === uid ? { ...u, credits: u.credits + numAmount, planExpiry: expiryDate.toISOString(), planType: planType || u.planType } : u
      ));
      
      setCustomAmount('');
      toast.success(`Successfully added ${numAmount} credits to user!`);
      fetchStats();
    } catch (error) {
      console.error('Injection Error:', error);
      toast.error('Failed to add credits.');
    } finally {
      setInjectingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/95 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0a0a0a] border-0 md:border md:border-white/10 w-full md:w-[96%] max-w-6xl h-full md:h-[96vh] rounded-none md:rounded-3xl overflow-hidden flex flex-col shadow-[0_0_100px_rgba(59,130,246,0.1)]"
      >
        {/* Header */}
        <div className="p-4 md:p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-b from-white/5 to-transparent">
          <div className="flex items-center gap-3 md:gap-5">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-primary/10 rounded-xl md:rounded-2xl flex items-center justify-center border border-primary/20 shadow-[0_0_20px_rgba(0,255,150,0.2)]">
              <Zap className="text-primary w-5 h-5 md:w-8 md:h-8" />
            </div>
            <div>
              <h2 className="text-lg md:text-2xl font-black tracking-tighter uppercase">Dibakar Admin</h2>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-primary rounded-full animate-pulse" />
                <p className="text-[8px] md:text-[10px] text-white/40 font-mono uppercase tracking-[0.2em]">Operational</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                toast.promise(new Promise((_, reject) => setTimeout(() => reject(new Error("Simulated System Crash")), 1000)), {
                  loading: 'Simulating crash...',
                  success: 'Wait, this should have crashed!',
                  error: 'Crash triggered! ErrorBoundary should catch this in 1.5s.',
                });
                setTimeout(() => { throw new Error("Admin Simulated Crash: Verification of ErrorBoundary"); }, 1500);
              }}
              className="p-3 hover:bg-red-500/10 hover:text-red-500 rounded-2xl transition-all border border-transparent hover:border-red-500/20"
              title="Test Error Boundary"
            >
              <AlertCircle size={20} />
            </button>
            <button 
              onClick={async () => {
                try {
                  const res = await fetch('/api/admin/setup-db', { method: 'POST' });
                  const data = await res.json();
                  if (data.success) {
                    toast.success('Database schema setup triggered. Please wait a few seconds.');
                  } else {
                    toast.error(data.error || 'Failed to trigger setup');
                  }
                } catch (err) {
                  toast.error('Network error');
                }
              }}
              className="p-3 hover:bg-blue-500/10 hover:text-blue-400 rounded-2xl transition-all border border-transparent hover:border-blue-500/20"
              title="Fix Database Schema"
            >
              <Shield size={20} />
            </button>
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

        <div className="flex-1 overflow-y-auto p-fluid space-y-fluid custom-scrollbar">
          {/* Stats Grid */}
          {statsLoading && !stats ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-28 md:h-36 bg-white/5 animate-pulse rounded-2xl md:rounded-[2rem] border border-white/5" />
              ))}
            </div>
          ) : stats && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <StatCard 
                  label="Requests" 
                  value={stats.totalRequests.toLocaleString()} 
                  icon={<Activity className="text-blue-400 w-4 h-4 md:w-5 md:h-5" />} 
                  sub="Global usage"
                />
                <StatCard 
                  label="Users" 
                  value={stats.totalUsers.toLocaleString()} 
                  icon={<Users className="text-purple-400 w-4 h-4 md:w-5 md:h-5" />} 
                  sub="Registered"
                />
                <StatCard 
                  label="Active" 
                  value={stats.activeToday.toLocaleString()} 
                  icon={<TrendingUp className="text-green-400 w-4 h-4 md:w-5 md:h-5" />} 
                  sub="Today"
                />
                <StatCard 
                  label="Chats" 
                  value={stats.totalChats.toLocaleString()} 
                  icon={<Zap className="text-yellow-400 w-4 h-4 md:w-5 md:h-5" />} 
                  sub="Started"
                />
              </div>

              {/* API Usage Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 flex flex-col lg:flex-row items-start lg:items-center gap-4 md:gap-8">
                  <div className="flex-1 space-y-1 md:space-y-2">
                    <h3 className="text-fluid-base md:text-lg font-bold flex items-center gap-2">
                      <Activity size={18} className="text-primary" /> Today's Usage
                    </h3>
                    <p className="text-[8px] md:text-xs text-white/40 uppercase tracking-widest">Llama & Serper</p>
                  </div>
                  <div className="flex gap-3 md:gap-6 w-full lg:w-auto">
                    <div className="flex-1 text-center px-3 md:px-6 py-3 md:py-4 bg-black/40 rounded-xl md:rounded-2xl border border-white/5">
                      <p className="text-lg md:text-2xl font-black text-blue-400 tracking-tighter">{stats.todayLlamaTokens.toLocaleString()}</p>
                      <p className="text-[8px] md:text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">Tokens</p>
                    </div>
                    <div className="flex-1 text-center px-3 md:px-6 py-3 md:py-4 bg-black/40 rounded-xl md:rounded-2xl border border-white/5">
                      <p className="text-lg md:text-2xl font-black text-purple-400 tracking-tighter">{stats.todaySerperRequests.toLocaleString()}</p>
                      <p className="text-[8px] md:text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">Requests</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 flex flex-col lg:flex-row items-start lg:items-center gap-4 md:gap-8">
                  <div className="flex-1 space-y-1 md:space-y-2">
                    <h3 className="text-fluid-base md:text-lg font-bold flex items-center gap-2">
                      <Activity size={18} className="text-green-400" /> Global Usage
                    </h3>
                    <p className="text-[8px] md:text-xs text-white/40 uppercase tracking-widest">Lifetime consumption</p>
                  </div>
                  <div className="flex gap-3 md:gap-6 w-full lg:w-auto">
                    <div className="flex-1 text-center px-3 md:px-6 py-3 md:py-4 bg-black/40 rounded-xl md:rounded-2xl border border-white/5">
                      <p className="text-lg md:text-2xl font-black text-blue-400 tracking-tighter">{stats.globalLlamaTokens.toLocaleString()}</p>
                      <p className="text-[8px] md:text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">Tokens</p>
                    </div>
                    <div className="flex-1 text-center px-3 md:px-6 py-3 md:py-4 bg-black/40 rounded-xl md:rounded-2xl border border-white/5">
                      <p className="text-lg md:text-2xl font-black text-purple-400 tracking-tighter">{stats.globalSerperRequests.toLocaleString()}</p>
                      <p className="text-[8px] md:text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">Requests</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 flex flex-col">
                  <h3 className="text-fluid-base md:text-lg font-bold flex items-center gap-2 mb-6 md:mb-8">
                    <ShoppingBag size={18} className="text-primary" /> Plan Distribution
                  </h3>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: '₹35 Starter', value: stats.plan35Count },
                            { name: '₹99 Pro', value: stats.plan99Count },
                            { name: 'Free Tier', value: stats.totalUsers - stats.premiumUsers }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="#3b82f6" />
                          <Cell fill="#a855f7" />
                          <Cell fill="rgba(255,255,255,0.1)" />
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#0f0f0f', 
                            border: '1px solid rgba(255,255,255,0.1)', 
                            borderRadius: '12px',
                            fontSize: '10px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="text-center">
                      <p className="text-xs font-black text-blue-400">{stats.plan35Count}</p>
                      <p className="text-[8px] text-white/40 uppercase tracking-widest">₹35</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-black text-purple-400">{stats.plan99Count}</p>
                      <p className="text-[8px] text-white/40 uppercase tracking-widest">₹99</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-black text-white/60">{stats.totalUsers - stats.premiumUsers}</p>
                      <p className="text-[8px] text-white/40 uppercase tracking-widest">Free</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 flex flex-col">
                  <h3 className="text-fluid-base md:text-lg font-bold flex items-center gap-2 mb-6 md:mb-8">
                    <Activity size={18} className="text-primary" /> Requests (7D)
                  </h3>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.requestsData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis dataKey="date" stroke="#ffffff20" fontSize={8} tickLine={false} axisLine={false} />
                        <YAxis stroke="#ffffff20" fontSize={8} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f0f0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }} />
                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={15} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 flex flex-col">
                  <h3 className="text-fluid-base md:text-lg font-bold flex items-center gap-2 mb-6 md:mb-8">
                    <TrendingUp size={18} className="text-primary" /> Growth (7D)
                  </h3>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.growthData}>
                        <defs>
                          <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke="#ffffff20" fontSize={8} tickLine={false} axisLine={false} />
                        <YAxis stroke="#ffffff20" fontSize={8} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f0f0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }} />
                        <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorGrowth)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* API Usage Trends Row */}
              <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 relative overflow-hidden group">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
                  <div>
                    <h3 className="text-fluid-base md:text-lg font-bold flex items-center gap-2">
                      <Activity size={18} className="text-primary" /> API Usage Trends
                    </h3>
                    <p className="text-[10px] md:text-xs text-white/40">7-day consumption</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 md:w-3 md:h-3 bg-blue-500 rounded-full" />
                      <span className="text-[8px] md:text-[10px] font-bold text-white/40 uppercase tracking-widest">Llama</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 md:w-3 md:h-3 bg-purple-500 rounded-full" />
                      <span className="text-[8px] md:text-[10px] font-bold text-white/40 uppercase tracking-widest">Serper</span>
                    </div>
                  </div>
                </div>
                <div className="h-[200px] md:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.usageData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#ffffff20" 
                        fontSize={8} 
                        tickLine={false} 
                        axisLine={false} 
                        dy={10}
                      />
                      <YAxis 
                        yAxisId="left"
                        stroke="#3b82f6" 
                        fontSize={8} 
                        tickLine={false} 
                        axisLine={false} 
                        dx={-10}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        stroke="#a855f7" 
                        fontSize={8} 
                        tickLine={false} 
                        axisLine={false} 
                        dx={10}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#0f0f0f', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '12px',
                          fontSize: '10px'
                        }}
                      />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="llamaTokens" 
                        stroke="#3b82f6" 
                        strokeWidth={2} 
                        dot={{ r: 2, fill: '#3b82f6', strokeWidth: 0 }} 
                        activeDot={{ r: 4, strokeWidth: 0 }}
                        name="Llama"
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="serperRequests" 
                        stroke="#a855f7" 
                        strokeWidth={2} 
                        dot={{ r: 2, fill: '#a855f7', strokeWidth: 0 }} 
                        activeDot={{ r: 4, strokeWidth: 0 }}
                        name="Serper"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Feedback Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 flex flex-col">
                  <h3 className="text-fluid-base md:text-lg font-bold flex items-center gap-2 mb-6 md:mb-8">
                    <Star size={18} className="text-yellow-400" /> User Satisfaction
                  </h3>
                  <div className="flex flex-col items-center justify-center mb-6 md:mb-8">
                    <div className="text-4xl md:text-6xl font-black text-white tracking-tighter">{stats.feedbackStats.averageRating}</div>
                    <div className="flex gap-1 mt-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star 
                          key={s} 
                          size={14} 
                          className={cn(
                            "transition-colors",
                            s <= Math.round(stats.feedbackStats.averageRating) ? "fill-yellow-400 text-yellow-400" : "text-white/10"
                          )} 
                        />
                      ))}
                    </div>
                    <p className="text-[8px] md:text-[10px] text-white/40 font-bold uppercase tracking-widest mt-4">Based on {stats.feedbackStats.totalFeedbacks} reviews</p>
                  </div>
                  <div className="space-y-3 md:space-y-4 flex-1">
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

                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 flex flex-col">
                  <div className="flex items-center justify-between mb-6 md:mb-8">
                    <h3 className="text-fluid-base md:text-lg font-bold flex items-center gap-2">
                      <MessageSquarePlus size={18} className="text-primary" /> Recent Feedback
                    </h3>
                    <button 
                      onClick={fetchFeedbacks}
                      className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 md:space-y-4 pr-2 custom-scrollbar max-h-[300px] md:max-h-[400px]">
                    {feedbacksLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="animate-spin text-primary" />
                      </div>
                    ) : feedbacks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-white/20">
                        <MessageSquarePlus className="mb-4 opacity-10 w-8 h-8 md:w-12 md:h-12" />
                        <p className="text-xs md:text-sm font-bold uppercase tracking-widest">No feedback yet</p>
                      </div>
                    ) : (
                      feedbacks.map((f) => (
                        <div key={f.id} className="p-3 md:p-4 bg-white/[0.02] border border-white/5 rounded-xl md:rounded-2xl hover:bg-white/[0.04] transition-all">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star 
                                    key={s} 
                                    className={cn("w-2 h-2 md:w-2.5 md:h-2.5", s <= f.rating ? "fill-yellow-400 text-yellow-400" : "text-white/10")} 
                                  />
                                ))}
                              </div>
                              <span className="text-[8px] md:text-[10px] font-bold text-white/60 truncate max-w-[100px] md:max-w-none">{f.userEmail || 'Anonymous'}</span>
                            </div>
                            <span className="text-[8px] md:text-[9px] font-mono text-white/20">
                              {f.createdAt ? format(new Date(f.createdAt), 'MMM dd, HH:mm') : 'Just now'}
                            </span>
                          </div>
                          {f.comment && (
                            <p className="text-[10px] md:text-xs text-white/80 leading-relaxed italic">"{f.comment}"</p>
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
          <div className="space-y-6 md:space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
              <div>
                <h3 className="text-fluid-xl md:text-2xl font-black tracking-tighter uppercase">User Management</h3>
                <p className="text-[10px] md:text-xs text-white/40">Search and modify user credits</p>
              </div>
              <form onSubmit={handleSearch} className="relative w-full max-w-xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 w-4.5 h-4.5 md:w-5 md:h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Email or phone..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl py-3 md:py-4 pl-12 pr-24 md:pr-32 focus:ring-2 ring-primary/50 outline-none text-fluid-sm md:text-sm transition-all focus:bg-white/10"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary hover:bg-blue-600 disabled:opacity-50 px-4 md:px-6 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all"
                >
                  {loading ? <RefreshCw size={14} className="animate-spin" /> : 'Search'}
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
              <AnimatePresence mode="popLayout">
                {foundUsers.map(user => (
                  <motion.div 
                    key={user.uid}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white/5 border border-white/10 p-fluid rounded-2xl md:rounded-[2rem] space-y-4 md:space-y-6 hover:border-primary/40 transition-all group relative overflow-hidden"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/20 transition-all overflow-hidden">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <User className="text-white/20 group-hover:text-primary/40 transition-all w-6 h-6 md:w-8 md:h-8" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-fluid-base md:text-lg truncate max-w-[150px] md:max-w-[200px]">{user.email || user.phoneNumber}</h4>
                          <p className="text-[8px] md:text-[10px] text-white/20 font-mono tracking-tighter truncate">ID: {user.uid}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={cn(
                              "text-[8px] md:text-[9px] font-black px-2 md:px-3 py-1 rounded-full uppercase tracking-widest",
                              user.role === 'admin' ? "bg-primary/20 text-primary" : "bg-white/10 text-white/40"
                            )}>
                              {user.role}
                            </span>
                            {user.planType && (
                              <span className="text-[8px] md:text-[9px] font-black px-2 md:px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-500 uppercase tracking-widest">
                                ₹{user.planType}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="text-left sm:text-right">
                          <div className="text-fluid-xl md:text-3xl font-black text-primary tracking-tighter flex items-center sm:justify-end gap-2">
                            <CreditCard className="opacity-40 w-5 h-5 md:w-6 md:h-6" /> {user.credits}
                          </div>
                          <p className="text-[8px] md:text-[10px] text-white/20 font-bold uppercase tracking-widest mt-1">Credits</p>
                        </div>
                        
                        {/* 3 Dots Menu */}
                        <div className="relative">
                          <button 
                            onClick={() => setActiveMenuId(activeMenuId === user.uid ? null : user.uid)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-all"
                          >
                            <MoreVertical size={20} className="text-white/40" />
                          </button>
                          
                          <AnimatePresence>
                            {activeMenuId === user.uid && (
                              <>
                                <div 
                                  className="fixed inset-0 z-40" 
                                  onClick={() => setActiveMenuId(null)}
                                />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                  className="absolute right-0 mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                                >
                                  <button 
                                    onClick={() => { toggleAdmin(user); setActiveMenuId(null); }}
                                    className="w-full px-4 py-3 text-left text-xs font-bold hover:bg-white/5 flex items-center gap-3 transition-all"
                                  >
                                    {user.role === 'admin' ? <ShieldAlert size={16} className="text-red-400" /> : <Shield size={16} className="text-primary" />}
                                    {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                                  </button>
                                  <button 
                                    onClick={() => { window.open(`mailto:${user.email}`); setActiveMenuId(null); }}
                                    className="w-full px-4 py-3 text-left text-xs font-bold hover:bg-white/5 flex items-center gap-3 transition-all"
                                  >
                                    <Mail size={16} className="text-blue-400" />
                                    Email User
                                  </button>
                                  <button 
                                    onClick={() => { toast.info(`Chat history for ${user.email || user.uid} is being fetched...`); setActiveMenuId(null); }}
                                    className="w-full px-4 py-3 text-left text-xs font-bold hover:bg-white/5 flex items-center gap-3 transition-all"
                                  >
                                    <MessageSquarePlus size={16} className="text-green-400" />
                                    View Chats
                                  </button>
                                  <button 
                                    onClick={() => { deleteUser(user.uid); setActiveMenuId(null); }}
                                    className="w-full px-4 py-3 text-left text-xs font-bold hover:bg-red-500/10 text-red-500 flex items-center gap-3 transition-all"
                                  >
                                    <Trash2 size={16} />
                                    Delete User
                                  </button>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                      <div className="space-y-2">
                        <p className="text-[8px] md:text-[10px] font-black text-white/20 uppercase tracking-widest">Quick Inject</p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => injectCredits(user.uid, 75, '35')} 
                            disabled={injectingId === user.uid}
                            className="flex-1 bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-primary/10 py-2.5 md:py-3 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all flex items-center justify-center gap-2"
                          >
                            {injectingId === user.uid ? <RefreshCw size={12} className="animate-spin" /> : <><PlusCircle size={12} /> ₹35</>}
                          </button>
                          <button 
                            onClick={() => injectCredits(user.uid, 300, '99')} 
                            disabled={injectingId === user.uid}
                            className="flex-1 bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-primary/10 py-2.5 md:py-3 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all flex items-center justify-center gap-2"
                          >
                            {injectingId === user.uid ? <RefreshCw size={12} className="animate-spin" /> : <><PlusCircle size={12} /> ₹99</>}
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-[8px] md:text-[10px] font-black text-white/20 uppercase tracking-widest">Manual</p>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            placeholder="Amount..."
                            className="flex-1 bg-black/40 border border-white/10 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-fluid-sm md:text-xs outline-none focus:ring-2 ring-primary/50 transition-all"
                          />
                          <button
                            onClick={() => injectCredits(user.uid, Number(customAmount))}
                            disabled={!customAmount || Number(customAmount) <= 0 || injectingId === user.uid}
                            className="bg-white text-black hover:bg-primary hover:text-white disabled:opacity-20 px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl text-fluid-sm md:text-xs font-black uppercase tracking-widest transition-all"
                          >
                            {injectingId === user.uid ? <RefreshCw size={12} className="animate-spin" /> : 'Add'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Background Glow Decor */}
                    <div className="absolute -right-10 -bottom-10 w-32 h-32 md:w-40 md:h-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all" />
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {foundUsers.length === 0 && !loading && searchTerm && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full py-12 md:py-20 text-center space-y-4 bg-white/[0.02] rounded-2xl md:rounded-[3rem] border border-dashed border-white/10"
                >
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="text-white/20 w-6 h-6 md:w-8 md:h-8" />
                  </div>
                  <div>
                    <h4 className="text-fluid-lg md:text-lg font-bold">No results</h4>
                    <p className="text-[10px] md:text-sm text-white/40">No users found for "{searchTerm}"</p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Subscription Requests Section */}
          <div className="space-y-6 md:space-y-8 pb-12">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-fluid-xl md:text-2xl font-black tracking-tighter uppercase">Subscription Requests</h3>
                <p className="text-[10px] md:text-xs text-white/40">Recent WhatsApp & Dashboard requests</p>
              </div>
              <button 
                onClick={fetchPremiumRequests}
                className="p-2 hover:bg-white/5 rounded-xl transition-all border border-white/5"
              >
                <RefreshCw size={18} className={cn(requestsLoading && "animate-spin")} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {requestsLoading && premiumRequests.length === 0 ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="h-48 bg-white/5 animate-pulse rounded-[2rem] border border-white/5" />
                ))
              ) : premiumRequests.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-white/[0.02] rounded-[2rem] border border-dashed border-white/10">
                  <ShoppingBag className="mx-auto mb-4 text-white/10" size={32} />
                  <p className="text-xs font-bold uppercase tracking-widest text-white/20">No pending requests</p>
                </div>
              ) : (
                premiumRequests.map((req) => (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "bg-white/5 border p-6 rounded-[2rem] space-y-4 transition-all relative overflow-hidden group",
                      req.status === 'pending' ? "border-primary/20" : "border-white/5 opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                          <User size={20} className="text-primary" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm truncate max-w-[120px]">{req.name}</h4>
                          <p className="text-[10px] text-white/40 font-mono">{req.phone}</p>
                        </div>
                      </div>
                      <div className={cn(
                        "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                        req.plan === '99' ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
                      )}>
                        ₹{req.plan}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[10px] text-white/60">
                        <Mail size={12} className="text-white/20" />
                        <span className="truncate">{req.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-white/60">
                        <Clock size={12} className="text-white/20" />
                        <span>{req.createdAt ? format(new Date(req.createdAt), 'MMM dd, HH:mm') : 'Just now'}</span>
                      </div>
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => updateRequestStatus(req.id, 'completed')}
                          className="flex-1 bg-primary hover:bg-blue-600 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                          <Check size={14} /> Complete
                        </button>
                        <button
                          onClick={() => updateRequestStatus(req.id, 'rejected')}
                          className="px-4 bg-white/5 hover:bg-red-500/10 hover:text-red-500 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    {req.status !== 'pending' && (
                      <div className="pt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-green-400">
                        <CheckCircle2 size={14} /> {req.status}
                      </div>
                    )}
                  </motion.div>
                ))
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
