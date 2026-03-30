import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import cors from "cors";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";

dotenv.config();

// Global error handlers to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

export const app = express();

const startServer = async () => {
  console.log("Starting Dibakar AI Server...");
  const PORT = 3000;

  // Initialize Groq inside startServer to use latest env vars
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const SERPER_API_KEY = process.env.SERPER_API_KEY;
  
  console.log("Environment Check:");
  console.log("- GROQ_API_KEY present:", !!GROQ_API_KEY);
  console.log("- SERPER_API_KEY present:", !!SERPER_API_KEY);
  console.log("- GOOGLE_CLOUD_PROJECT:", process.env.GOOGLE_CLOUD_PROJECT);
  console.log("- FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID);
  console.log("- PORT:", process.env.PORT);
  
  let db: any = null;

  try {
    console.log("Initializing Firebase Admin...");
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      try {
        const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
        const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
        const dbId = firebaseConfig.firestoreDatabaseId;
        
        console.log(`[Firebase] Config Project ID: ${projectId}`);
        console.log(`[Firebase] Target Database ID: ${dbId || '(default)'}`);
        console.log(`[Firebase] NODE_ENV: ${process.env.NODE_ENV}`);
        
        // Use the default app if possible, otherwise use a named app
        const adminApp = getApps().length === 0 
          ? initializeApp({ projectId: projectId }) 
          : getApps()[0];
        
        console.log(`[Firebase] Admin SDK initialized with project: ${projectId}`);
        
        try {
          // Try initializing with the specific database ID from config
          if (dbId && dbId !== "(default)") {
            db = getFirestore(adminApp, dbId);
            console.log(`[Firebase] Firestore initialized with database: ${dbId}`);
          } else {
            db = getFirestore(adminApp);
            console.log("[Firebase] Firestore initialized with default database");
          }
          
          // Test connection/permissions immediately
          const testRef = db.collection('test_connection').doc('server_boot');
          await testRef.set({
            timestamp: FieldValue.serverTimestamp(),
            message: "Server started",
            env: process.env.NODE_ENV,
            projectId,
            dbId: dbId || '(default)'
          }, { merge: true });
          console.log("[Firebase] Connection test successful");
        } catch (dbInitErr: any) {
          console.error("[Firebase] Failed to initialize Firestore or connection test failed:", dbInitErr.message);
          if (dbInitErr.message.includes('PERMISSION_DENIED') || dbInitErr.message.includes('NOT_FOUND')) {
            console.error(`[Firebase] CRITICAL: ${dbInitErr.message.includes('PERMISSION_DENIED') ? 'Permission denied' : 'Database not found'}. Check IAM roles or database ID.`);
            // Fallback to default database if named one fails
            if (dbId && dbId !== "(default)") {
              console.log("[Firebase] Attempting fallback to default database...");
              db = getFirestore(adminApp);
            }
          }
        }
      } catch (jsonErr) {
        console.error("Failed to parse firebase-applet-config.json:", jsonErr);
      }
    } else {
      console.warn("firebase-applet-config.json not found. Stats tracking will be disabled.");
    }
  } catch (err) {
    console.error("Failed to initialize Firebase Admin:", err);
  }

  app.use(cors());
  app.use(express.json());

  // Email transporter setup
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER || "dibakar61601@gmail.com",
      pass: process.env.GMAIL_PASS, // This should be an App Password
    },
  });

  // Test endpoint for Firebase
  app.get("/api/test-firebase", async (req, res) => {
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin not initialized" });
    }

    try {
      const testRef = db.collection('test_connection').doc('manual_test');
      await testRef.set({
        timestamp: FieldValue.serverTimestamp(),
        message: "Manual test from /api/test-firebase",
        userAgent: req.headers['user-agent']
      }, { merge: true });
      
      res.json({ success: true, message: "Firestore write successful" });
    } catch (err: any) {
      console.error("Manual Firebase test failed:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // API routes
  app.post("/api/premium-request", async (req, res) => {
    const { email, name, phone, plan } = req.body;

    if (!email || !name || !phone || !plan) {
      return res.status(400).json({ error: "All fields are required" });
    }

    try {
      // 1. Send email to Admin (munshidipa62@gmail.com)
      const adminMailOptions = {
        from: process.env.GMAIL_USER || "dibakar61601@gmail.com",
        to: "munshidipa62@gmail.com",
        subject: `New Premium Request from ${name}`,
        text: `
          New Premium Request Details:
          ---------------------------
          Name: ${name}
          Email: ${email}
          Phone: ${phone}
          Plan: ${plan}
          Time: ${new Date().toLocaleString()}
          
          User has requested for a premium plan. Please contact them within 24 hours.
        `,
      };

      // 2. Send confirmation email to User
      const userMailOptions = {
        from: process.env.GMAIL_USER || "dibakar61601@gmail.com",
        to: email,
        subject: "Dibakar AI - Premium Request Successful",
        text: `
          Hello ${name},

          Your premium request was successful! 
          
          Apna premium request liya gaya hai. Under 24 hours Dibakar AI team ap sa contact karega.

          Details:
          Plan: ${plan}
          Phone: ${phone}

          Thank you for choosing Dibakar AI!
        `,
      };

      // 3. Send WhatsApp to Admin via CallMeBot (Background)
      const CALLMEBOT_API_KEY = process.env.CALLMEBOT_API_KEY;
      const adminPhone = "919242959903";
      
      if (CALLMEBOT_API_KEY) {
        try {
          const whatsappMsg = `*New Premium Request* 🚀\n\n*Name:* ${name}\n*Email:* ${email}\n*Phone:* ${phone}\n*Plan:* ${plan}`;
          const callMeBotUrl = `https://api.callmebot.com/whatsapp.php?phone=${adminPhone}&text=${encodeURIComponent(whatsappMsg)}&apikey=${CALLMEBOT_API_KEY}`;
          
          await axios.get(callMeBotUrl);
          console.log("WhatsApp notification sent via CallMeBot");
        } catch (waErr: any) {
          console.error("CallMeBot WhatsApp Error:", waErr.message);
        }
      } else {
        console.warn("CALLMEBOT_API_KEY not set. WhatsApp notification skipped.");
      }

      if (process.env.GMAIL_PASS) {
        await transporter.sendMail(adminMailOptions);
        await transporter.sendMail(userMailOptions);
        res.json({ success: true, message: "Request sent successfully" });
      } else {
        console.warn("GMAIL_PASS not set. Email not sent, but request logged.");
        res.json({ success: true, message: "Request logged (WhatsApp/Email skipped - Keys missing)" });
      }
    } catch (error: any) {
      console.error("Email API Error:", error.message);
      res.status(500).json({ error: "Failed to send request" });
    }
  });

  // Global request logger
  app.use((req, res, next) => {
    // Only log non-Vite internal requests to reduce noise
    if (!req.url.startsWith('/@vite') && !req.url.startsWith('/src/') && !req.url.startsWith('/node_modules/')) {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    }
    next();
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      firebase: !!db, 
      hasKeys: !!(GROQ_API_KEY && SERPER_API_KEY),
      env: process.env.NODE_ENV
    });
  });

  // API routes
  app.post("/api/search", async (req, res) => {
    const { query, history = [] } = req.body;
    console.log(`Received search request: "${query}"`);

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    if (!GROQ_API_KEY || !SERPER_API_KEY) {
      console.error("Missing API keys in request handler");
      return res.status(500).json({ error: "API keys are missing. Please set GROQ_API_KEY and SERPER_API_KEY in settings." });
    }

    const groq = new Groq({ apiKey: GROQ_API_KEY });

    try {
      // 1. Check if it's a simple greeting or conversational query
      const lowerQuery = query.toLowerCase().trim();
      const greetings = [
        "hi", "hello", "hey", "namaste", "salaam", "kaise ho", "how are you", 
        "who are you", "what is your name", "kya haal hai", "good morning", 
        "good afternoon", "good evening", "bye", "thanks", "thank you",
        "hi dibakar", "hello dibakar", "hey dibakar", "dibakar ai", "who made you"
      ];
      
      // Improved autoswitch: Check for greetings or very short conversational queries
      // Also check if the query is just a single word or very short (less than 15 chars)
      const isGreeting = lowerQuery.length < 25 && (
        greetings.some(g => lowerQuery.includes(g)) || 
        lowerQuery.split(' ').length <= 2
      );
      console.log(`Query type: ${isGreeting ? 'Greeting/Conversational' : 'Search'}`);

      let context = "";
      let sources: any[] = [];

      if (!isGreeting) {
        try {
          console.log("Calling Serper.dev...");
          const serperRes = await axios.post(
            "https://google.serper.dev/search",
            { q: query, num: 3 },
            { 
              headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
              timeout: 8000 // 8 second timeout for search
            }
          );

          sources = serperRes.data.organic || [];
          context = sources
            .map((s: any, i: number) => `Source [${i + 1}]: ${s.title}\nURL: ${s.link}\nSnippet: ${s.snippet}`)
            .join("\n\n");
          console.log(`Serper found ${sources.length} sources`);
        } catch (serperErr: any) {
          console.error("Serper API Error:", serperErr.response?.data || serperErr.message);
          // Fallback to direct answer if Serper fails
        }
      }

      // 3. Call Groq (Llama-3)
      console.log("Calling Groq...");
      const systemInstruction = `You are Dibakar AI. Synthesize the web context into a structured, accurate answer using markdown. Always reply in the exact same language the user typed in (Hindi, Bengali, or English). If context is provided, use it. If not, answer directly as a helpful AI assistant. Put the source links at the end if context was used.
      
      Context:
      ${context || "No web context needed for this query."}`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemInstruction },
          ...history.map((h: any) => ({ role: h.role, content: h.content })),
          { role: "user", content: query },
        ],
        model: "llama-3.3-70b-versatile",
      }, { timeout: 25000 }); // Increased timeout to 25 seconds

      if (!chatCompletion || !chatCompletion.choices || chatCompletion.choices.length === 0) {
        throw new Error("Groq API returned an empty response");
      }

      const answer = chatCompletion.choices[0]?.message?.content || "I'm sorry, I couldn't generate an answer.";
      const llamaTokens = chatCompletion.usage?.total_tokens || 0;
      console.log("Groq response received successfully");

      // 4. Record Usage in Firestore
      if (db) {
        try {
          const today = new Date().toISOString().split('T')[0];
          const dailyStatsRef = db.collection('stats').doc(`daily_${today}`);
          const globalStatsRef = db.collection('stats').doc('global');

          const updateStats = async (ref: any) => {
            try {
              console.log(`Attempting to update stats at: ${ref.path}`);
              // Ensure the document exists by using set with merge
              await ref.set({
                totalRequests: FieldValue.increment(1),
                llamaTokens: FieldValue.increment(llamaTokens),
                serperRequests: FieldValue.increment(context ? 1 : 0),
                lastUpdated: FieldValue.serverTimestamp(),
                date: today
              }, { merge: true });
              console.log(`Successfully updated stats at: ${ref.path}`);
            } catch (innerErr: any) {
              console.error(`Failed to update specific stat ref (${ref.path}):`, innerErr.message);
              // If NOT_FOUND, it might be the database itself.
              if (innerErr.message.includes('NOT_FOUND')) {
                console.error(`[Firebase] Database or path not found for ${ref.path}. Check firestoreDatabaseId.`);
              }
            }
          };

          await Promise.all([
            updateStats(dailyStatsRef),
            updateStats(globalStatsRef)
          ]);
          console.log("Usage stats updated in Firestore");
        } catch (dbErr) {
          console.error("Failed to update stats in Firestore:", dbErr);
        }
      }

      res.json({
        answer,
        sources: sources.map(s => ({ title: s.title, link: s.link, snippet: s.snippet })),
        usage: {
          llamaTokens,
          serperRequests: context ? 1 : 0
        }
      });
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      console.error("Search API Error:", errorData);
      
      if (error.status === 401 || (typeof errorData === 'string' && errorData.includes('invalid_api_key'))) {
        return res.status(401).json({ 
          error: "Invalid API Key. Please check your GROQ_API_KEY and SERPER_API_KEY in the settings." 
        });
      }
      
      res.status(500).json({ error: "Failed to process search" });
    }
  });

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled Express Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite middleware...");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
        root: process.cwd(),
      });
      app.use(vite.middlewares);
      console.log("Vite middleware initialized");
    } catch (viteErr) {
      console.error("Failed to initialize Vite middleware:", viteErr);
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  try {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer().catch((err) => {
  console.error("Unhandled error during server startup:", err);
  process.exit(1);
});
