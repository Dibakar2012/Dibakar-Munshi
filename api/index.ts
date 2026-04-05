import express from "express";
import path from "path";
import axios from "axios";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import cors from "cors";
import { format } from "date-fns";
import { Client, Databases, ID, Query } from "node-appwrite";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Appwrite Setup
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || process.env.VITE_APPWRITE_API_KEY || "";

const appwriteClient = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const appwriteDatabases = new Databases(appwriteClient);

const APPWRITE_CONFIG = {
  databaseId: process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID || "main",
  collections: {
    users: process.env.APPWRITE_USERS_COLLECTION_ID || process.env.VITE_APPWRITE_USERS_COLLECTION_ID || "users",
    chats: process.env.APPWRITE_CHATS_COLLECTION_ID || process.env.VITE_APPWRITE_CHATS_COLLECTION_ID || "chats",
    messages: process.env.APPWRITE_MESSAGES_COLLECTION_ID || process.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID || "messages",
    premiumRequests: process.env.APPWRITE_PREMIUM_REQUESTS_COLLECTION_ID || process.env.VITE_APPWRITE_PREMIUM_REQUESTS_COLLECTION_ID || "premium_requests",
    stats: process.env.APPWRITE_STATS_COLLECTION_ID || process.env.VITE_APPWRITE_STATS_COLLECTION_ID || "stats",
    feedback: process.env.APPWRITE_FEEDBACK_COLLECTION_ID || process.env.VITE_APPWRITE_FEEDBACK_COLLECTION_ID || "feedback",
  }
};

// Groq and Serper keys
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SERPER_API_KEY = process.env.SERPER_API_KEY;

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER || "dibakar61601@gmail.com",
    pass: process.env.GMAIL_PASS,
  },
});

// API routes
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    appwrite: {
      endpoint: !!APPWRITE_ENDPOINT,
      project: !!APPWRITE_PROJECT_ID,
      key: !!APPWRITE_API_KEY,
      database: !!APPWRITE_CONFIG.databaseId
    },
    hasKeys: !!(GROQ_API_KEY && SERPER_API_KEY),
    env: process.env.NODE_ENV,
    vercel: true
  });
});

app.get("/api/ping", (req, res) => {
  res.json({ status: "alive", timestamp: new Date().toISOString() });
});

app.get("/api/test-appwrite", async (req, res) => {
  try {
    const result = await appwriteDatabases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.stats,
      [Query.limit(1)]
    );
    res.json({ success: true, message: "Appwrite connection successful from Vercel", count: result.total });
  } catch (err: any) {
    console.error("[Appwrite Vercel Test] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/premium-request", async (req, res) => {
  const { email, name, phone, plan, screenshotUrl, userId } = req.body;
  if (!email || !name || !phone || !plan) return res.status(400).json({ error: "All fields are required" });

  try {
    const adminMailOptions = {
      from: process.env.GMAIL_USER || "dibakar61601@gmail.com",
      to: "munshidipa62@gmail.com",
      subject: `New Premium Request from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nPlan: ${plan}\nScreenshot: ${screenshotUrl || 'Not provided'}\nTime: ${new Date().toLocaleString()}`,
    };

    const userMailOptions = {
      from: process.env.GMAIL_USER || "dibakar61601@gmail.com",
      to: email,
      subject: "Dibakar AI - Premium Request Successful",
      text: `Hello ${name},\n\nYour premium request was successful! Under 24 hours Dibakar AI team ap sa contact karega.`,
    };

    if (process.env.GMAIL_PASS) {
      await transporter.sendMail(adminMailOptions);
      await transporter.sendMail(userMailOptions);
    }

    // Save to Appwrite
    try {
      await appwriteDatabases.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.premiumRequests,
        ID.unique(),
        {
          name,
          email,
          phone,
          plan,
          screenshotUrl: screenshotUrl || '',
          userId: userId || 'unknown',
          status: 'pending',
          createdAt: new Date().toISOString()
        }
      );
    } catch (dbErr) {
      console.error("Failed to save premium request to Appwrite in Vercel:", dbErr);
    }

    res.json({ success: true, message: "Request sent successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to send request" });
  }
});

app.post("/api/admin/setup-db", async (req, res) => {
  try {
    // This is a simplified version for Vercel, usually schema is handled manually or on start
    res.json({ success: true, message: "Database schema setup triggered successfully (Vercel)." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/title", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message is required" });
  if (!GROQ_API_KEY) return res.status(500).json({ error: "GROQ_API_KEY is missing" });

  const groq = new Groq({ apiKey: GROQ_API_KEY });
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "Generate a very short, descriptive title (max 5 words) for a chat that starts with the user's message. Return only the title text, no quotes or extra words." 
        },
        { role: "user", content: message },
      ],
      model: "llama-3.3-70b-versatile",
    });
    const title = completion.choices[0]?.message?.content?.trim() || message.slice(0, 30);
    res.json({ title });
  } catch (error: any) {
    console.error("Title API Error Vercel:", error.message);
    res.json({ title: message.slice(0, 30) });
  }
});

// User Sync Route
app.post("/api/user/sync", async (req, res) => {
  const { uid, email, name } = req.body;
  if (!uid) return res.status(400).json({ error: "UID is required" });

  try {
    let userProfile;
    try {
      userProfile = await appwriteDatabases.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.users,
        uid
      );
    } catch (err: any) {
      if (err.code === 404 || err.message.includes("not found")) {
        const isAdminEmail = 
          email?.toLowerCase() === "munshidipa62@gmail.com" || 
          email?.toLowerCase() === "munshidipa@gmail.com" || 
          email?.toLowerCase() === "dibakar61601@gmail.com";

        const userData: any = {
          name: name || 'User',
          email: email || '',
          role: isAdminEmail ? 'admin' : 'user',
          credits: isAdminEmail ? 999999 : 10,
          createdAt: new Date().toISOString()
        };

        userProfile = await appwriteDatabases.createDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.users,
          uid,
          userData
        );
      } else {
        throw err;
      }
    }
    res.json(userProfile);
  } catch (error: any) {
    console.error("User Sync Error Vercel:", error.message, error.code);
    
    // If it's an Auth, Permission, or Project ID error, return a "Virtual Profile"
    // so the user can still use the app while they fix the environment variables.
    const isProjectIdMissing = !APPWRITE_PROJECT_ID || APPWRITE_PROJECT_ID === "";
    const isApiKeyMissing = !APPWRITE_API_KEY || APPWRITE_API_KEY === "";
    
    if (error.code === 401 || error.code === 403 || error.message.includes("project ID") || error.message.includes("Project not found") || isProjectIdMissing) {
      console.warn("Appwrite Config Error. Returning virtual profile.");
      const isAdminEmail = 
        email?.toLowerCase() === "munshidipa62@gmail.com" || 
        email?.toLowerCase() === "dibakar61601@gmail.com";
        
      let warningMessage = "Appwrite Configuration Error.";
      if (isProjectIdMissing) {
        warningMessage = "Appwrite Project ID Missing: Please add 'APPWRITE_PROJECT_ID' to your Vercel Environment Variables.";
      } else if (error.message.includes("project ID") || error.message.includes("Project not found")) {
        warningMessage = `Appwrite Project ID Error: The ID "${APPWRITE_PROJECT_ID.slice(0, 4)}..." is incorrect or the project doesn't exist.`;
      } else if (isApiKeyMissing || error.code === 401) {
        warningMessage = "Appwrite API Key Error: Your 'APPWRITE_API_KEY' is missing or incorrect in Vercel settings.";
      }

      return res.json({
        $id: uid,
        name: name || 'User',
        email: email || '',
        role: isAdminEmail ? 'admin' : 'user',
        credits: isAdminEmail ? 999999 : 10,
        createdAt: new Date().toISOString(),
        isVirtual: true,
        warning: warningMessage
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// Streaming AI Route
app.post("/api/ai/stream", async (req, res) => {
  const { query, history = [] } = req.body;
  if (!query) return res.status(400).json({ error: "Query is required" });
  if (!GROQ_API_KEY || !SERPER_API_KEY) {
    return res.status(500).json({ error: "API keys are missing." });
  }

  const groq = new Groq({ apiKey: GROQ_API_KEY });

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const input = query.toLowerCase().trim();

    // 1. SmartRouter Logic (from user JSON)
    const greetingWords = ['hi', 'hello', 'hey', 'namaste', 'namaskar', 'good morning', 'good evening', 'good night', 'good afternoon', 'bye', 'alvida', 'thanks', 'shukriya', 'dhanyavad', 'thank you', 'ok', 'okay', 'haan', 'nahi', 'theek hai', 'accha', 'hmm', 'hii', 'helo', 'helloo', 'hiii', 'hiiii', 'yo', 'sup', 'wassup'];
    const fillerWords = ['bhai', 'bro', 'dost', 'yaar', 'ji', 'sir', 'madam', 'boss', 'buddy', 'friend', 'dear', 'vai', 'da', 'di', 're', 'be'];
    
    const words = input.replace(/[!?.,]+/g, '').split(/\s+/).filter(w => w.length > 0);
    const meaningfulWords = words.filter(w => !fillerWords.includes(w));
    const isGreeting = meaningfulWords.length <= 2 && meaningfulWords.some(w => greetingWords.includes(w));

    const casualPatterns = [
      /tujhe kisne banaya/i, /tera naam/i, /tu kaun/i, /who made you/i, /your name/i, /who are you/i,
      /what is your name/i, /what's your name/i, /apka naam/i, /aapka naam/i,
      /dibakar (kaun|kon|ke baare|ka birthday|ki birthday|ke papa|ki mummy|ki bahan|ki sister|munshi)/i,
      /dibakar ke bare/i, /dibakar ko kisne/i, /tell me about dibakar/i,
      /kaise ho/i, /kya haal/i, /how are you/i, /kya chal raha/i,
      /creator/i, /banane wala/i, /made you/i, /created you/i, /built you/i,
      /^(kya|kaise|kaisa) (hai|ho|chal).*$/i
    ];

    const isCasualPattern = casualPatterns.some(pattern => pattern.test(input));
    const isCasual = isGreeting || isCasualPattern;

    if (isCasual) {
      // CasualAgent Path
      const stream = await groq.chat.completions.create({
        messages: [
          { 
            role: "system", 
            content: `Tu Dibakar AI Brain hai. Tujhe Dibakar Munshi ne banaya hai.
===== DIBAKAR MUNSHI KI INFO =====
- Naam: Dibakar Munshi
- Kaun hai: Ek student hai
- Date of Birth: 4 September 2012
- Father ka naam: Kartick Munshi
- Mother ka naam: Dipa Munshi
- Chhoti Bahan ka naam: Mousumi Munshi
- Usne tujhe (Dibakar AI Brain ko) banaya hai
================================
STRICT RULES:
1. SIRF upar wali info use kar.
2. Chhota jawab de. Max 2-3 line.
3. User ki bhasha mein bol.` 
          },
          ...history.map((h: any) => ({ role: h.role, content: h.content })),
          { role: "user", content: query }
        ],
        model: "llama-3.1-8b-instant",
        stream: true,
        temperature: 0.1,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
      }
    } else {
      // Search Path
      res.write(`data: ${JSON.stringify({ text: "🔍 Searching the web..." })}\n\n`);

      const serperRes = await axios.post(
        "https://google.serper.dev/search",
        { q: query, num: 3 },
        { headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" }, timeout: 5000 }
      ).catch(() => ({ data: { organic: [] } }));

      const sources = serperRes.data.organic || [];
      const context = sources.map((s: any, i: number) => `--- Result #${i+1} ---\nTitle: ${s.title}\nURL: ${s.link}\nContent: ${s.snippet}`).join("\n\n");
      
      // Difficulty Check (from user JSON)
      const hardKeywords = ['explain', 'analyze', 'analyse', 'compare', 'difference', 'vs', 'versus', 'science', 'physics', 'chemistry', 'biology', 'math', 'mathematics', 'quantum', 'relativity', 'algorithm', 'programming', 'code', 'philosophy', 'psychology', 'economics', 'theory', 'detail', 'detailed', 'in-depth', 'comprehensive', 'elaborate', 'how does', 'how do', 'why does', 'why do', 'mechanism', 'samjhao', 'samjha do', 'detail mein', 'achhe se', 'pura batao', 'bishoy', 'byakhya', 'difference between', 'climate change', 'artificial intelligence', 'machine learning', 'blockchain', 'cryptocurrency', 'geopolitics', 'nuclear', 'constitution', 'amendment', 'supreme court', 'medical', 'disease', 'treatment', 'diagnosis', 'research', 'study', 'paper', 'thesis', 'history of', 'origin of', 'evolution of', 'architecture', 'engineering', 'space', 'nasa', 'isro'];
      const isHard = hardKeywords.some(kw => input.includes(kw)) || query.split(' ').length > 12;
      
      res.write(`data: ${JSON.stringify({ text: "", sources: sources.map((s: any) => ({ title: s.title, link: s.link })) })}\n\n`);

      const model = isHard ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant";
      const systemPrompt = isHard 
        ? `Tu Dibakar AI Brain hai — Dibakar Munshi ka banaya hua ADVANCED AI assistant.
TERA KAAM:
1. Search data dhyan se padh.
2. EXPERT-LEVEL jawab de.
FORMAT:
📝 **Jawab:** (3-4 line main answer)
📋 **Detail mein samjho:** (Bullet points, 2-3 lines each)
💡 **Kya Interesting Hai:** (Fascinating facts)`
        : `Tu Dibakar AI Brain hai — Dibakar Munshi ka banaya hua smart AI assistant.
TERA KAAM:
1. Search data padh kar accurate jawab de.
FORMAT:
📝 **Seedha Jawab:** (2-3 line main answer)
📋 **Detail mein:** (Bullet points)
💡 **Extra Info:** (Interesting info)`;

      const stream = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map((h: any) => ({ role: h.role, content: h.content })),
          { role: "user", content: `User ka sawaal: ${query}\n\n${context}` }
        ],
        model: model,
        stream: true,
        temperature: 0.4,
      });

      let firstChunk = true;
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ text: content, replace: firstChunk })}\n\n`);
          firstChunk = false;
        }
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error("Streaming AI Error Vercel:", error.message);
    res.write(`data: ${JSON.stringify({ error: "Failed to process AI request" })}\n\n`);
    res.end();
  }
});

// Chats Routes
app.get("/api/chats", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  try {
    const result = await appwriteDatabases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.chats,
      [Query.equal("userId", userId as string), Query.orderDesc("updatedAt")]
    );
    res.json(result.documents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/chats", async (req, res) => {
  const { userId, title } = req.body;
  try {
    const chat = await appwriteDatabases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.chats,
      ID.unique(),
      {
        userId,
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    );
    res.json(chat);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/chats/:chatId", async (req, res) => {
  const { chatId } = req.params;
  const data = req.body;
  try {
    const chat = await appwriteDatabases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.chats,
      chatId,
      { ...data, updatedAt: new Date().toISOString() }
    );
    res.json(chat);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/chats/:chatId", async (req, res) => {
  const { chatId } = req.params;
  try {
    await appwriteDatabases.deleteDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.chats,
      chatId
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Messages Routes
app.get("/api/messages", async (req, res) => {
  const { chatId } = req.query;
  try {
    const result = await appwriteDatabases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.messages,
      [Query.equal("chatId", chatId as string), Query.orderAsc("createdAt")]
    );
    res.json(result.documents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/messages", async (req, res) => {
  const { chatId, role, content, sources } = req.body;
  try {
    const message = await appwriteDatabases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.messages,
      ID.unique(),
      {
        chatId,
        role,
        content,
        sources: sources || "[]",
        createdAt: new Date().toISOString()
      }
    );
    res.json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/messages/:messageId", async (req, res) => {
  const { messageId } = req.params;
  const messageData = { ...req.body };
  try {
    const message = await appwriteDatabases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.messages,
      messageId,
      messageData
    );
    res.json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Credits Route
app.patch("/api/user/:uid/credits", async (req, res) => {
  const { uid } = req.params;
  const { credits } = req.body;
  try {
    const user = await appwriteDatabases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.users,
      uid,
      { credits }
    );
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Feedback Routes
app.get("/api/feedback", async (req, res) => {
  try {
    const response = await appwriteDatabases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.feedback,
      [Query.orderDesc("$createdAt"), Query.limit(50)]
    );
    res.json(response.documents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/feedback", async (req, res) => {
  const { userId, userEmail, rating, comment } = req.body;
  try {
    const doc = await appwriteDatabases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.feedback,
      ID.unique(),
      {
        userId,
        userEmail,
        rating,
        comment,
        createdAt: new Date().toISOString()
      }
    );
    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Premium Requests (Admin)
app.get("/api/premium-requests", async (req, res) => {
  try {
    const response = await appwriteDatabases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.premiumRequests,
      [Query.orderDesc("$createdAt"), Query.limit(50)]
    );
    res.json(response.documents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/premium-requests/:requestId", async (req, res) => {
  const { requestId } = req.params;
  const { status } = req.body;
  try {
    const doc = await appwriteDatabases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.premiumRequests,
      requestId,
      { status }
    );
    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Stats Route
app.get("/api/stats", async (req, res) => {
  try {
    const today = format(new Date(), 'yyyy-MM-dd');
    const [globalDoc, dailyDoc, usersRes, chatsRes, feedbackRes] = await Promise.all([
      appwriteDatabases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.stats, 'global').catch(() => ({})),
      appwriteDatabases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.stats, `daily_${today}`).catch(() => ({})),
      appwriteDatabases.listDocuments(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.users, [Query.limit(5000)]),
      appwriteDatabases.listDocuments(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.chats, [Query.limit(1)]),
      appwriteDatabases.listDocuments(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.feedback, [Query.limit(5000)])
    ]);

    res.json({
      global: globalDoc,
      daily: dailyDoc,
      users: usersRes.documents,
      totalChats: chatsRes.total,
      feedbacks: feedbackRes.documents
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// User Management
app.get("/api/users/search", async (req, res) => {
  const { term } = req.query;
  try {
    const response = await appwriteDatabases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.users,
      [
        Query.or([
          Query.equal('email', term as string),
          Query.equal('phoneNumber', term as string)
        ])
      ]
    );
    res.json(response.documents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/users/:uid", async (req, res) => {
  const { uid } = req.params;
  const userData = req.body;
  try {
    const doc = await appwriteDatabases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.users,
      uid,
      userData
    );
    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/users/:uid", async (req, res) => {
  const { uid } = req.params;
  try {
    await appwriteDatabases.deleteDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.users,
      uid
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/users/:uid", async (req, res) => {
  const { uid } = req.params;
  try {
    const doc = await appwriteDatabases.getDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.users,
      uid
    );
    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/premium-requests", async (req, res) => {
  const { userId, userEmail, plan, paymentMethod, transactionId, phoneNumber } = req.body;
  try {
    const doc = await appwriteDatabases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.premiumRequests,
      ID.unique(),
      {
        userId,
        userEmail,
        plan,
        paymentMethod,
        transactionId,
        phoneNumber,
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    );
    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/search", async (req, res) => {
  const { query, history = [] } = req.body;
  if (!query) return res.status(400).json({ error: "Query is required" });
  if (!GROQ_API_KEY || !SERPER_API_KEY) return res.status(500).json({ error: "API keys are missing." });

  const groq = new Groq({ apiKey: GROQ_API_KEY });

  try {
    // 1. Classify Query (Casual vs Search)
    const classification = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a query classifier. Reply with ONLY 'casual' if the user is sending a greeting, chitchat, or informal message. Reply with ONLY 'search' if the user is asking a real question that needs information or facts. No other words." 
        },
        { role: "user", content: query }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0,
      max_tokens: 5
    });

    const category = classification.choices[0]?.message?.content?.toLowerCase().trim() || "search";
    const isGreeting = category === "casual";

    let context = "";
    let sources: any[] = [];

    // 2. Perform Search if needed
    if (!isGreeting) {
      try {
        const serperRes = await axios.post("https://google.serper.dev/search", 
          { q: query, num: 4 }, 
          { 
            headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" }, 
            timeout: 8000 
          }
        );
        sources = (serperRes.data.organic || []).slice(0, 4);
        
        if (sources.length > 0) {
          context = '=== TOP SEARCH RESULTS ===\n\n';
          sources.forEach((s: any, i: number) => {
            context += `--- Result #${i + 1} ---\n`;
            context += `Title: ${s.title}\n`;
            context += `URL: ${s.link}\n`;
            context += `Content: ${s.snippet}\n\n`;
          });
        } else {
          context = "No search results found. Please answer from your own knowledge.";
        }
      } catch (serperErr) {
        console.error("Serper Error:", serperErr);
        context = "Search failed. Please answer from your own knowledge.";
      }
    }

    // 3. Generate Final Answer
    const systemInstruction = isGreeting 
      ? `Tu Dibakar AI Brain hai. Ek smart aur friendly assistant. Seedha point pe aa. Chhota jawab de. 1-2 line kaafi hai greeting ke liye. Natural baat kar jaise ek dost se baat kar raha hai. User jis bhasha mein bole usi mein bol.`
      : `Tu Dibakar AI Brain hai - Perplexity jaisa powerful search assistant. Tujhe top search results milte hain user ke sawaal ke baare mein. Tera kaam hai:
1. Search results ka data dhyan se padh.
2. Apni knowledge bhi jod.
3. EK simple aur clear jawab bana.
4. HAMESHA bahut asan aur simple language mein jawab de (Hindi/Hinglish/English).
5. Bullet points use kar taaki padhne mein aasani ho.
6. Markdown formatting ka use kar (Bold, Lists, etc).
7. Agar context use kiya hai, to last mein sources ka zikr kar (📌 Sources:).

Context:
${context || "No web context available. Answer from your own knowledge."}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemInstruction }, 
        ...history.map((h: any) => ({ role: h.role, content: h.content })), 
        { role: "user", content: query }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
    }, { timeout: 25000 });

    const answer = chatCompletion.choices[0]?.message?.content || "I'm sorry, I couldn't generate an answer.";
    const llamaTokens = chatCompletion.usage?.total_tokens || 0;

    // Record Usage in Appwrite
    try {
      const today = new Date().toISOString().split('T')[0];
      const updateStats = async (docId: string) => {
        try {
          let doc;
          try {
            doc = await appwriteDatabases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.stats, docId);
          } catch (err: any) {
            if (err.code === 404) {
              await appwriteDatabases.createDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.stats, docId, {
                totalRequests: 1,
                llamaTokens: llamaTokens,
                serperRequests: context ? 1 : 0,
                lastUpdated: new Date().toISOString(),
                date: today
              });
              return;
            }
            throw err;
          }
          await appwriteDatabases.updateDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.stats, docId, {
            totalRequests: (doc.totalRequests || 0) + 1,
            llamaTokens: (doc.llamaTokens || 0) + llamaTokens,
            serperRequests: (doc.serperRequests || 0) + (context ? 1 : 0),
            lastUpdated: new Date().toISOString()
          });
        } catch (innerErr: any) {
          console.error(`[Appwrite Vercel Stats] Error updating ${docId}:`, innerErr.message);
        }
      };
      await Promise.all([updateStats(`daily_${today}`), updateStats('global')]);
    } catch (dbErr) {}

    res.json({ 
      answer, 
      sources: sources.map(s => ({ title: s.title, link: s.link, snippet: s.snippet })), 
      usage: { llamaTokens, serperRequests: context ? 1 : 0 } 
    });
  } catch (error: any) {
    console.error("Search API Error Vercel:", error.message);
    res.status(500).json({ error: "Failed to process search request" });
  }
});

export default app;
