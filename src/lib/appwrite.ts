/// <reference types="vite/client" />
import { Client, Account, Databases, Storage, ID, Query } from 'appwrite';

const client = new Client()
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID || '');

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export { client, ID, Query };

export const APPWRITE_CONFIG = {
    databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID || '',
    collections: {
        users: import.meta.env.VITE_APPWRITE_USERS_COLLECTION_ID || '',
        chats: import.meta.env.VITE_APPWRITE_CHATS_COLLECTION_ID || '',
        messages: import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID || '',
        stats: import.meta.env.VITE_APPWRITE_STATS_COLLECTION_ID || '',
        feedback: import.meta.env.VITE_APPWRITE_FEEDBACK_COLLECTION_ID || '',
        premiumRequests: import.meta.env.VITE_APPWRITE_PREMIUM_REQUESTS_COLLECTION_ID || '',
    },
    bucketId: import.meta.env.VITE_APPWRITE_BUCKET_ID || '',
};
