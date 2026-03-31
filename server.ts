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
  const PORT = process.env.PORT || 3000;

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
          
          // Test connection/permissions gracefully without blocking or crashing
          // We use a simple get instead of set to avoid write permission issues during boot
          const testRef = db.collection('test_connection').doc('server_boot');
          testRef.get().then(() => {
            console.log("[Firebase] Connection test successful (read)");
          }).catch((err: any) => {
            console.warn("[Firebase] Optional connection test failed (read):", err.message);
          });
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

  // Keep-alive endpoint for Render
  app.get("/api/ping", (req, res) => {
    res.json({ status: "alive", timestamp: new Date().toISOString() });
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

      // 3. Log the request
      console.log(`[Premium Request] Success: ${name} (${email}) for plan ${plan}`);

      // 4. Save to Firestore for Admin Dashboard
      if (db) {
        try {
          await db.collection('premium_requests').add({
            name,
            email,
            phone,
            plan,
            status: 'pending',
            createdAt: FieldValue.serverTimestamp()
          });
          console.log("Premium request saved to Firestore");
        } catch (dbErr) {
          console.error("Failed to save premium request to Firestore:", dbErr);
        }
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

  // Health check and Keep-alive
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      firebase: !!db, 
      hasKeys: !!(GROQ_API_KEY && SERPER_API_KEY),
      env: process.env.NODE_ENV,
      uptime: process.uptime()
    });
  });

  // API route for chat title generation
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
      console.error("Title API Error:", error.message);
      res.json({ title: message.slice(0, 30) });
    }
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
      // 1. SmartRouter: Classify the query
      console.log("Routing query...");
      const routerCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a query classifier. Your ONLY job is to classify the user's message into exactly one category. Reply with ONLY one word - nothing else:\n- Reply 'casual' if the user is sending a greeting, chitchat, hi, hello, namaste, thanks, bye, good morning, or any informal non-question message. ALSO include identity questions like 'who are you', 'tum kon ho', 'aapka naam kya hai', etc.\n- Reply 'search' if the user is asking a real question that needs information, facts, news, how-to, or web search\n\nIMPORTANT: Reply with ONLY the single word 'casual' or 'search'. No explanation, no punctuation, no other text."
          },
          { role: "user", content: query }
        ],
        model: "llama-3.1-8b-instant",
        temperature: 0,
      });

      const route = routerCompletion.choices[0]?.message?.content?.toLowerCase().trim() || "search";
      console.log(`SmartRouter decision: ${route}`);

      let answer = "";
      let sources: any[] = [];
      let context = "";
      let llamaTokens = routerCompletion.usage?.total_tokens || 0;

      if (route.includes("casual")) {
        // 2. CasualAgent Path
        console.log("Executing CasualAgent path...");
        const casualCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: "Tu Dibakar AI Brain hai. Ek smart aur friendly assistant.\n\nRULES:\n- Seedha point pe aa. Faltu bakwaas mat kar.\n- Chhota jawab de. 1-2 line kaafi hai greeting ke liye.\n- Natural baat kar jaise ek dost se baat kar raha hai.\n- User jis bhasha mein bole usi mein bol.\n- Apna naam 'Dibakar AI Brain' bata agar pehli baar baat ho.\n- Fokat ka gyaan mat de. Bas pooch kya help chahiye.\n\nEXAMPLES:\n- User: hi → Tu: Hey! Main Dibakar AI Brain hoon. Bata kya jaanna hai?\n- User: hello → Tu: Hello! Kya help chahiye?\n- User: namaste → Tu: Namaste! Batao kya search karna hai?\n- User: kaise ho → Tu: Badhiya hoon! Bol kya karna hai?\n- User: thanks → Tu: Welcome! Aur kuch poochna ho to bol.\n- User: bye → Tu: Bye! Phir aana jab zaroorat ho."
            },
            ...history.map((h: any) => ({ role: h.role, content: h.content })),
            { role: "user", content: query }
          ],
          model: "llama-3.1-8b-instant",
          temperature: 0.3,
        });
        answer = casualCompletion.choices[0]?.message?.content || "";
        llamaTokens += casualCompletion.usage?.total_tokens || 0;
      } else {
        // 3. Search Path
        console.log("Executing Search path...");
        
        // 3a. SerperSearch
        try {
          console.log("Calling Serper.dev...");
          const serperRes = await axios.post(
            "https://google.serper.dev/search",
            { q: query, num: 3 },
            { 
              headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
              timeout: 8000
            }
          );

          sources = serperRes.data.organic || [];
          
          // 3b. CleanData (Logic from JSON)
          if (sources.length > 0) {
            context = "=== TOP 3 SEARCH RESULTS ===\n\n";
            sources.slice(0, 3).forEach((item: any, index: number) => {
              context += `--- Result #${index + 1} ---\n`;
              context += `Title: ${item.title || 'No title'}\n`;
              context += `URL: ${item.link || ''}\n`;
              context += `Content: ${item.snippet || 'No description available'}\n\n`;
            });
          } else {
            context = "No search results found. Please answer from your own knowledge.";
          }
          console.log(`Serper found ${sources.length} sources`);
        } catch (serperErr: any) {
          console.error("Serper API Error:", serperErr.response?.data || serperErr.message);
          context = "Search failed. Please answer from your own knowledge.";
        }

        // 3c. SearchAgent
        console.log("Calling SearchAgent...");
        const searchCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: `Tu Dibakar AI Brain hai - Perplexity jaisa powerful search assistant. Tujhe top 3 websites ke results milte hain user ke sawaal ke baare mein. Tera kaam hai:

1. Teeno websites ka data dhyan se padh
2. Apni knowledge bhi jod
3. EK simple aur clear jawab bana

LANGUAGE RULES (BAHUT IMPORTANT):
- HAMESHA bahut asan aur simple language mein jawab de
- Jaise kisi chhote bachche ko samjha raha ho
- Koi mushkil ya technical word mat use kar
- Chhote chhote sentences likh - ek line mein ek baat
- User jis language mein bole usi mein jawab de (Hindi/Hinglish/English)
- Agar English mein bhi jawab de raha hai to simple English use kar
- Bullet points use kar taaki padhne mein aasani ho

FORMAT:
- Pehle seedha jawab de (2-3 line mein main point)
- Phir thoda detail mein samjha (bullet points mein)
- Last mein sources daal with links:
  📌 Sources:
  1. [website name](link)
  2. [website name](link)
  3. [website name](link)

- Kabhi bhi ads ya promotional content mat daal

Context:
${context}`
            },
            ...history.map((h: any) => ({ role: h.role, content: h.content })),
            { role: "user", content: `User ka sawaal: ${query}` }
          ],
          model: "llama-3.1-8b-instant",
          temperature: 0.3,
        });

        answer = searchCompletion.choices[0]?.message?.content || "";
        llamaTokens += searchCompletion.usage?.total_tokens || 0;
      }

      // Post-process to remove any accidental sources section
      const cleanAnswer = answer
        .replace(/(?:\n|^)(?:Sources|References|संदर्भ|উৎস|Links|Citations|📌 Sources):[\s\S]*$/i, '')
        .replace(/\[\d+\]/g, '')
        .trim();

      console.log("Response generated successfully");

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
        answer: cleanAnswer,
        sources: sources.map((s: any) => ({ title: s.title, link: s.link, snippet: s.snippet })),
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
    console.log("Initializing Vite middleware (DEVELOPMENT mode)...");
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
    console.log("Running in PRODUCTION mode");
    const distPath = path.join(process.cwd(), "dist");
    console.log("Serving static files from:", distPath);
    
    // Serve static files
    app.use(express.static(distPath));
    
    // Handle SPA routing
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error("Error sending index.html:", err);
          res.status(500).send(`
            <html>
              <body style="background: #0a0a0a; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center;">
                <div>
                  <h1 style="color: #3b82f6;">Build Files Not Found</h1>
                  <p>The server is running in production mode but the 'dist' folder is missing or index.html is not found.</p>
                  <p style="color: #9ca3af; font-size: 0.8rem;">Path: ${indexPath}</p>
                  <code style="background: #1a1a1a; padding: 10px; border-radius: 8px; display: block; margin-top: 20px;">npm run build</code>
                </div>
              </body>
            </html>
          `);
        }
      });
    });
  }

  try {
    const portNumber = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
    app.listen(portNumber, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${portNumber}`);
      
      // Keep-alive mechanism for Render free plan
      // This pings the server every 5 minutes to prevent it from sleeping
      const rawAppUrl = process.env.APP_URL || `http://localhost:${portNumber}`;
      const APP_URL = rawAppUrl.trim();
      console.log(`[Keep-Alive] Initialized for: ${APP_URL}`);
      
      const performPing = async () => {
        try {
          const pingUrl = `${APP_URL.endsWith('/') ? APP_URL.slice(0, -1) : APP_URL}/api/ping`;
          await axios.get(pingUrl);
          console.log(`[Keep-Alive] Ping successful at ${new Date().toLocaleTimeString()} to ${pingUrl}`);
        } catch (error: any) {
          // If it fails, try localhost as fallback
          try {
            const localPingUrl = `http://localhost:${portNumber}/api/ping`;
            await axios.get(localPingUrl);
            console.log(`[Keep-Alive] Localhost fallback ping successful to ${localPingUrl}`);
          } catch (localErr: any) {
            console.error(`[Keep-Alive] All pings failed. Error:`, localErr.message);
          }
        }
      };

      // Initial ping on startup
      performPing();
      
      // Periodic ping every 5 minutes
      setInterval(performPing, 5 * 60 * 1000);
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
