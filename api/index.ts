import express from "express";
import path from "path";
import axios from "axios";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import cors from "cors";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
let db: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
    const dbId = firebaseConfig.firestoreDatabaseId;
    
    const adminApp = getApps().length === 0 
      ? initializeApp({ projectId: projectId }) 
      : getApps()[0];
    
    if (dbId && dbId !== "(default)") {
      db = getFirestore(adminApp, dbId);
    } else {
      db = getFirestore(adminApp);
    }
  }
} catch (err) {
  console.error("Failed to initialize Firebase Admin in Vercel:", err);
}

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
    firebase: !!db, 
    hasKeys: !!(GROQ_API_KEY && SERPER_API_KEY),
    env: process.env.NODE_ENV,
    vercel: true
  });
});

app.get("/api/test-firebase", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firebase Admin not initialized" });
  try {
    const testRef = db.collection('test_connection').doc('vercel_test');
    await testRef.set({
      timestamp: FieldValue.serverTimestamp(),
      message: "Manual test from Vercel /api/test-firebase",
      userAgent: req.headers['user-agent']
    }, { merge: true });
    res.json({ success: true, message: "Firestore write successful from Vercel" });
  } catch (err: any) {
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

    if (db) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const dailyStatsRef = db.collection('stats').doc(`daily_${today}`);
        const globalStatsRef = db.collection('stats').doc('global');
        const updateStats = async (ref: any) => {
          await ref.set({ totalRequests: FieldValue.increment(1), llamaTokens: FieldValue.increment(llamaTokens), serperRequests: FieldValue.increment(context ? 1 : 0), lastUpdated: FieldValue.serverTimestamp(), date: today }, { merge: true });
        };
        await Promise.all([updateStats(dailyStatsRef), updateStats(globalStatsRef)]);
      } catch (dbErr) {}
    }

    res.json({ answer, sources: sources.map(s => ({ title: s.title, link: s.link, snippet: s.snippet })), usage: { llamaTokens, serperRequests: context ? 1 : 0 } });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to process search" });
  }
});

export default app;
