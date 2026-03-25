export interface UserProfile {
  uid: string;
  email?: string;
  phoneNumber?: string;
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
