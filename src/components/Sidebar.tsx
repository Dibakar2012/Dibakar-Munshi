import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Chat } from '../types';
import { Plus, MessageSquare, MoreVertical, Trash, Edit2, ChevronLeft, ChevronRight, LayoutDashboard, X } from 'lucide-react';
import { format, isToday, isYesterday, isAfter, subDays } from 'date-fns';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  isAdmin: boolean;
  onOpenAdmin: () => void;
  onClose: () => void;
}

export default function Sidebar({ currentChatId, onSelectChat, onNewChat, isAdmin, onOpenAdmin, onClose }: SidebarProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (!user) {
        setChats([]);
        return;
      }

      const q = query(
        collection(db, 'chats'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat)));
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const groupChats = () => {
    const groups: { [key: string]: Chat[] } = {
      Today: [],
      Yesterday: [],
      Older: []
    };

    chats.forEach(chat => {
      const date = new Date(chat.createdAt);
      if (isToday(date)) groups.Today.push(chat);
      else if (isYesterday(date)) groups.Yesterday.push(chat);
      else groups.Older.push(chat);
    });

    return groups;
  };

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) return;
    await updateDoc(doc(db, 'chats', id), { title: editTitle });
    setEditingChatId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'chats', id));
    setDeleteConfirmId(null);
  };

  const groups = groupChats();

  return (
    <div className="fixed inset-0 z-[60] flex">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-[85%] max-w-[320px] h-full bg-surface border-r border-border flex flex-col shadow-2xl"
      >
        <div className="p-4 flex items-center justify-between border-b border-border">
          <span className="font-bold text-xl text-primary">Chat History</span>
          <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <button
          onClick={onNewChat}
          className="m-4 flex items-center gap-2 bg-primary hover:bg-blue-600 text-white rounded-xl p-4 font-bold transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={20} />
          <span>New Chat</span>
        </button>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {Object.entries(groups).map(([label, groupChats]) => (
            groupChats.length > 0 && (
              <div key={label} className="mb-6">
                <h3 className="px-3 text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-3">{label}</h3>
                {groupChats.map(chat => (
                  <div
                    key={chat.id}
                    className={cn(
                      "group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all mb-1",
                      currentChatId === chat.id 
                        ? "bg-primary/10 text-primary border border-primary/20" 
                        : "text-text-muted hover:bg-surface-hover hover:text-white border border-transparent"
                    )}
                    onClick={() => onSelectChat(chat.id)}
                  >
                    <MessageSquare size={18} className="shrink-0" />
                    <div className="flex-1 truncate text-sm font-medium">
                      {editingChatId === chat.id ? (
                        <input
                          autoFocus
                          className="bg-transparent border-none outline-none w-full"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => handleRename(chat.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRename(chat.id)}
                        />
                      ) : (
                        chat.title
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === chat.id ? null : chat.id); }}
                          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-text-muted hover:text-white"
                        >
                          <MoreVertical size={14} />
                        </button>
                        
                        <AnimatePresence>
                          {menuOpenId === chat.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: 5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 5 }}
                              className="absolute right-0 mt-2 w-36 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
                            >
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingChatId(chat.id); setEditTitle(chat.title); setMenuOpenId(null); }}
                                className="w-full flex items-center gap-2 px-4 py-3 text-xs font-medium hover:bg-surface-hover transition-colors"
                              >
                                <Edit2 size={12} /> Rename
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(chat.id); setMenuOpenId(null); }}
                                className="w-full flex items-center gap-2 px-4 py-3 text-xs font-medium hover:bg-surface-hover text-red-500 transition-colors"
                              >
                                <Trash size={12} /> Delete
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <AnimatePresence>
                      {deleteConfirmId === chat.id && (
                        <div 
                          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                        >
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-surface border border-border rounded-2xl p-6 max-w-xs w-full shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                              <Trash className="text-red-500" size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-center mb-2">Delete Chat?</h3>
                            <p className="text-sm text-text-muted text-center mb-6">
                              This action cannot be undone. All messages in this chat will be lost.
                            </p>
                            <div className="flex gap-3">
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-surface-hover hover:bg-border text-sm font-bold transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleDelete(chat.id)}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )
          ))}
        </div>

        <div className="p-4 border-t border-border bg-surface/50 space-y-2">
          <button
            onClick={() => window.location.href = 'tel:9242959903'}
            className="w-full flex items-center justify-center gap-2 bg-surface-hover hover:bg-border text-text-muted rounded-xl p-3 font-bold transition-all text-sm"
          >
            <Plus size={18} className="rotate-45" />
            <span>Customer Care</span>
          </button>
          
          {isAdmin && (
            <button
              onClick={onOpenAdmin}
              className="w-full flex items-center justify-center gap-2 bg-surface-hover hover:bg-border text-primary rounded-xl p-3 font-bold transition-all text-sm"
            >
              <LayoutDashboard size={18} />
              <span>Admin Dashboard</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
