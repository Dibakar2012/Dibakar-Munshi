export interface UserProfile {
  uid: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  photoURL?: string;
  credits: number;
  role: 'user' | 'admin';
  planExpiry?: string;
  planType?: '35' | '99';
  createdAt?: string;
}

export interface Chat {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SearchSource[];
  feedback?: 'up' | 'down' | null;
  createdAt: string;
}

export interface SearchSource {
  title: string;
  link: string;
  snippet: string;
}

export interface SearchResponse {
  answer: string;
  sources: SearchSource[];
}

export interface PremiumRequest {
  id: string;
  userId?: string;
  name: string;
  email: string;
  phone: string;
  plan: '35' | '99';
  status: 'pending' | 'completed' | 'rejected';
  createdAt: any;
}
