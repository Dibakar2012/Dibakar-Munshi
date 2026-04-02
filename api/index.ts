import express from "express";
import path from "path";
import axios from "axios";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import cors from "cors";
import { Client, Databases, ID, Query } from "node-appwrite";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Appwrite Setup
const appwriteClient = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
  .setProject(process.env.APPWRITE_PROJECT_ID || "")
  .setKey(process.env.APPWRITE_API_KEY || "");

const appwriteDatabases = new Databases(appwriteClient);

const APPWRITE_CONFIG = {
  databaseId: process.env.APPWRITE_DATABASE_ID || "main",
  collections: {
    premiumRequests: process.env.APPWRITE_PREMIUM_REQUESTS_COLLECTION_ID || "premium_requests",
    stats: process.env.APPWRITE_STATS_COLLECTION_ID || "stats",
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
    appwrite: true, 
    hasKeys: !!(GROQ_API_KEY && SERPER_API_KEY),
    env: process.env.NODE_ENV,
    vercel: true
  });
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
  const { email, name, phone, plan } = req.body;
  if (!email || !name || !phone || !plan) return res.status(400).json({ error: "All fields are required" });

  try {
    const adminMailOptions = {
      from: process.env.GMAIL_USER || "dibakar61601@gmail.com",
      to: "munshidipa62@gmail.com",
      subject: `New Premium Request from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nPlan: ${plan}\nTime: ${new Date().toLocaleString()}`,
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

app.post("/api/search", async (req, res) => {
  const { query, history = [] } = req.body;
  if (!query) return res.status(400).json({ error: "Query is required" });
  if (!GROQ_API_KEY || !SERPER_API_KEY) return res.status(500).json({ error: "API keys are missing." });

  const groq = new Groq({ apiKey: GROQ_API_KEY });

  try {
    const lowerQuery = query.toLowerCase().trim();
    const greetings = ["hi", "hello", "hey", "namaste", "salaam", "kaise ho", "how are you", "who are you", "what is your name", "kya haal hai", "good morning", "good afternoon", "good evening", "bye", "thanks", "thank you", "hi dibakar", "hello dibakar", "hey dibakar", "dibakar ai", "who made you"];
    const isGreeting = lowerQuery.length < 25 && (greetings.some(g => lowerQuery.includes(g)) || lowerQuery.split(' ').length <= 2);

    let context = "";
    let sources: any[] = [];

    if (!isGreeting) {
      try {
        const serperRes = await axios.post("https://google.serper.dev/search", { q: query, num: 3 }, { headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" }, timeout: 8000 });
        sources = serperRes.data.organic || [];
        context = sources.map((s: any, i: number) => `Source [${i + 1}]: ${s.title}\nURL: ${s.link}\nSnippet: ${s.snippet}`).join("\n\n");
      } catch (serperErr) {}
    }

    const systemInstruction = `You are Dibakar AI. Synthesize the web context into a structured, accurate answer using markdown. Always reply in the exact same language the user typed in (Hindi, Bengali, or English). If context is provided, use it. If not, answer directly as a helpful AI assistant. Put the source links at the end if context was used.\n\nContext:\n${context || "No web context needed for this query."}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "system", content: systemInstruction }, ...history.map((h: any) => ({ role: h.role, content: h.content })), { role: "user", content: query }],
      model: "llama-3.3-70b-versatile",
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

    res.json({ answer, sources: sources.map(s => ({ title: s.title, link: s.link, snippet: s.snippet })), usage: { llamaTokens, serperRequests: context ? 1 : 0 } });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to process search" });
  }
});

export default app;
