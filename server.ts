import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import cors from "cors";
import fs from "fs";
import { format } from "date-fns";
import { Client, Databases, ID, Query } from "node-appwrite";

dotenv.config();

// Global error handlers to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

import compression from "compression";

export const app = express();

// Optimization Middlewares
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cors());

const startServer = async () => {
  console.log("Starting Dibakar AI Server...");
  const PORT = process.env.PORT || 3000;

  // Appwrite Setup
  const appwriteClient = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
    .setProject(process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "")
    .setKey(process.env.APPWRITE_API_KEY || "");

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

  // Auto-Initialize Appwrite Schema
  const initializeAppwriteSchema = async () => {
    console.log("Checking Appwrite Schema...");
    const dbId = APPWRITE_CONFIG.databaseId;
    
    const schema = [
      {
        collectionId: APPWRITE_CONFIG.collections.users,
        attributes: [
          { key: "name", type: "string", size: 255, required: false },
          { key: "email", type: "string", size: 255, required: false },
          { key: "role", type: "string", size: 50, required: false },
          { key: "credits", type: "integer", required: false },
          { key: "createdAt", type: "string", size: 50, required: false },
        ]
      },
      {
        collectionId: APPWRITE_CONFIG.collections.chats,
        attributes: [
          { key: "userId", type: "string", size: 255, required: true },
          { key: "title", type: "string", size: 255, required: true },
          { key: "createdAt", type: "string", size: 50, required: true },
          { key: "updatedAt", type: "string", size: 50, required: true },
        ]
      },
      {
        collectionId: APPWRITE_CONFIG.collections.messages,
        attributes: [
          { key: "chatId", type: "string", size: 255, required: true },
          { key: "role", type: "string", size: 50, required: true },
          { key: "content", type: "string", size: 65535, required: true },
          { key: "sources", type: "string", size: 65535, required: false },
          { key: "createdAt", type: "string", size: 50, required: true },
        ]
      },
      {
        collectionId: APPWRITE_CONFIG.collections.feedback,
        attributes: [
          { key: "userId", type: "string", size: 255, required: true },
          { key: "userEmail", type: "string", size: 255, required: true },
          { key: "rating", type: "integer", required: true },
          { key: "comment", type: "string", size: 1000, required: false },
          { key: "createdAt", type: "string", size: 50, required: true },
        ]
      },
      {
        collectionId: APPWRITE_CONFIG.collections.premiumRequests,
        attributes: [
          { key: "userId", type: "string", size: 255, required: true },
          { key: "userEmail", type: "string", size: 255, required: true },
          { key: "userName", type: "string", size: 255, required: true },
          { key: "plan", type: "string", size: 50, required: true },
          { key: "message", type: "string", size: 1000, required: false },
          { key: "status", type: "string", size: 50, required: true },
          { key: "createdAt", type: "string", size: 50, required: true },
        ]
      },
      {
        collectionId: APPWRITE_CONFIG.collections.stats,
        attributes: [
          { key: "totalRequests", type: "integer", required: false },
          { key: "llamaTokens", type: "integer", required: false },
          { key: "serperRequests", type: "integer", required: false },
          { key: "lastUpdated", type: "string", size: 50, required: false },
          { key: "date", type: "string", size: 50, required: false },
        ]
      }
    ];

    for (const col of schema) {
      try {
        console.log(`Checking collection: ${col.collectionId}`);
        try {
          await appwriteDatabases.getCollection(dbId, col.collectionId);
        } catch (getColErr: any) {
          if (getColErr.code === 404) {
            console.log(`Collection ${col.collectionId} missing. Creating...`);
            await appwriteDatabases.createCollection(dbId, col.collectionId, col.collectionId);
            // Wait for Appwrite to create the collection
            await new Promise(r => setTimeout(r, 2000));
          } else {
            throw getColErr;
          }
        }

        const existingAttrs = await appwriteDatabases.listAttributes(dbId, col.collectionId);
        const existingKeys = existingAttrs.attributes.map((a: any) => a.key);

        for (const attr of col.attributes) {
          if (!existingKeys.includes(attr.key)) {
            console.log(`Creating attribute ${attr.key} in ${col.collectionId}...`);
            try {
              if (attr.type === "string") {
                await appwriteDatabases.createStringAttribute(dbId, col.collectionId, attr.key, attr.size || 255, attr.required);
              } else if (attr.type === "integer") {
                await appwriteDatabases.createIntegerAttribute(dbId, col.collectionId, attr.key, attr.required);
              }
              // Wait a bit for Appwrite to process
              await new Promise(r => setTimeout(r, 1000));
            } catch (attrErr: any) {
              console.error(`Failed to create attribute ${attr.key}:`, attrErr.message);
            }
          }
        }
      } catch (colErr: any) {
        console.error(`Error checking collection ${col.collectionId}:`, colErr.message);
      }
    }
    console.log("Appwrite Schema Check Complete.");
  };

  // Run schema initialization
  if (process.env.APPWRITE_API_KEY) {
    initializeAppwriteSchema().catch(err => console.error("Schema Init Error:", err));
  }

  // Check for critical environment variables
  const missingVars = [];
  if (!process.env.APPWRITE_API_KEY) missingVars.push('APPWRITE_API_KEY');
  if (!process.env.APPWRITE_DATABASE_ID && !process.env.VITE_APPWRITE_DATABASE_ID) missingVars.push('APPWRITE_DATABASE_ID or VITE_APPWRITE_DATABASE_ID');
  if (!process.env.APPWRITE_USERS_COLLECTION_ID && !process.env.VITE_APPWRITE_USERS_COLLECTION_ID) missingVars.push('APPWRITE_USERS_COLLECTION_ID or VITE_APPWRITE_USERS_COLLECTION_ID');
  if (!process.env.APPWRITE_PROJECT_ID && !process.env.VITE_APPWRITE_PROJECT_ID) missingVars.push('APPWRITE_PROJECT_ID or VITE_APPWRITE_PROJECT_ID');
  
  if (missingVars.length > 0) {
    console.error(`CRITICAL: Missing environment variables on Render: ${missingVars.join(', ')}`);
    console.error("Please add these variables in your Render Dashboard -> Environment Settings.");
  } else {
    console.log("All critical Appwrite environment variables are present.");
    console.log("- Project ID:", process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID);
    console.log("- Database ID:", process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID);
    console.log("- API Key length:", process.env.APPWRITE_API_KEY?.length || 0);
  }

  // Initialize Groq inside startServer to use latest env vars
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const SERPER_API_KEY = process.env.SERPER_API_KEY;
  
  console.log("Environment Check:");
  console.log("- GROQ_API_KEY present:", !!GROQ_API_KEY);
  console.log("- SERPER_API_KEY present:", !!SERPER_API_KEY);
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

  // Keep-alive endpoint for Render
  app.get("/api/ping", (req, res) => {
    res.json({ status: "alive", timestamp: new Date().toISOString() });
  });

  app.post("/api/admin/setup-db", async (req, res) => {
    try {
      await initializeAppwriteSchema();
      res.json({ success: true, message: "Database schema setup triggered successfully." });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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

      // 3. Log the request
      console.log(`[Premium Request] Success: ${name} (${email}) for plan ${plan}`);

      // 4. Save to Appwrite for Admin Dashboard
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
        console.log("Premium request saved to Appwrite");
      } catch (dbErr) {
        console.error("Failed to save premium request to Appwrite:", dbErr);
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
      appwrite: true, 
      hasKeys: !!(GROQ_API_KEY && SERPER_API_KEY),
      env: process.env.NODE_ENV,
      uptime: process.uptime()
    });
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
        if (err.code === 404) {
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

          let success = false;
          let retryCount = 0;
          const maxRetries = Object.keys(userData).length;

          while (!success && retryCount <= maxRetries) {
            try {
              userProfile = await appwriteDatabases.createDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.users,
                uid,
                userData
              );
              success = true;
            } catch (createErr: any) {
              // Self-healing: If "Unknown attribute" error occurs, try to remove the offending field
              if (createErr.message.includes("Unknown attribute") && retryCount < maxRetries) {
                const attr = createErr.message.split('"')[1];
                if (attr && userData[attr] !== undefined) {
                  console.warn(`Self-healing: Removing unknown attribute "${attr}" and retrying...`);
                  delete userData[attr];
                  retryCount++;
                  continue;
                }
              }
              
              // If we reach here and the error is "document data is missing", 
              // it means the collection has NO attributes defined at all.
              // We return a "Virtual Profile" so the user isn't blocked, but warn them.
              if (createErr.message.includes("document data is missing")) {
                console.error("Appwrite Error: 'users' collection has no attributes. Returning virtual profile.");
                userProfile = {
                  $id: uid,
                  ...userData,
                  isVirtual: true,
                  warning: "Appwrite Schema Error: Your 'users' collection has NO attributes defined. Data will not be saved until you add attributes in the Appwrite Console."
                };
                success = true;
                break;
              }
              
              throw createErr;
            }
          }
        } else {
          throw err;
        }
      }
      res.json(userProfile);
      } catch (error: any) {
      console.error("User Sync Error:", error.message, error.code);
      let errorMessage = error.message;
      
      if (error.code === 404) {
        errorMessage = `Appwrite Resource Not Found: Check if Database ID "${APPWRITE_CONFIG.databaseId}" and Collection ID "${APPWRITE_CONFIG.collections.users}" exist.`;
      } else if (error.code === 401) {
        errorMessage = "Appwrite Authentication Error: Your APPWRITE_API_KEY is incorrect or missing permissions. Please check your Render Dashboard -> Environment Settings and ensure the API Key has 'Database' and 'Collection' permissions.";
      } else if (error.code === 403) {
        errorMessage = "Appwrite Permission Error: Your API Key does not have the necessary permissions. Ensure you have enabled 'Database' and 'Collection' scopes for this key in the Appwrite Console.";
      } else if (error.message.includes("Unknown attribute")) {
        const attr = error.message.split('"')[1] || "unknown";
        errorMessage = `Appwrite Schema Error: The attribute "${attr}" is missing in your "users" collection. Please add a string attribute named "${attr}" in the Appwrite Console.`;
      } else if (error.message.includes("document data is missing")) {
        errorMessage = "Appwrite Schema Error: Your 'users' collection has NO attributes defined. Please go to Appwrite Console and add these attributes to the 'users' collection: 'name' (string), 'email' (string), 'role' (string), 'credits' (integer), 'createdAt' (string).";
      }
      
      res.status(500).json({ error: errorMessage });
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
    const chatData: any = {
      userId,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    try {
      let success = false;
      let retryCount = 0;
      const maxRetries = Object.keys(chatData).length;
      let chat;

      while (!success && retryCount <= maxRetries) {
        try {
          chat = await appwriteDatabases.createDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.chats,
            ID.unique(),
            chatData
          );
          success = true;
        } catch (createErr: any) {
          if (createErr.message.includes("Unknown attribute") && retryCount < maxRetries) {
            const attr = createErr.message.split('"')[1];
            if (attr && chatData[attr] !== undefined) {
              console.warn(`Self-healing (Chat): Removing unknown attribute "${attr}" and retrying...`);
              delete chatData[attr];
              retryCount++;
              continue;
            }
          }
          throw createErr;
        }
      }
      res.json(chat);
    } catch (error: any) {
      console.error("Chat Creation Error:", error.message);
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
    const messageData: any = {
      chatId,
      role,
      content,
      sources: sources || "[]",
      createdAt: new Date().toISOString()
    };
    try {
      let success = false;
      let retryCount = 0;
      const maxRetries = Object.keys(messageData).length;
      let message;

      while (!success && retryCount <= maxRetries) {
        try {
          message = await appwriteDatabases.createDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.messages,
            ID.unique(),
            messageData
          );
          success = true;
        } catch (createErr: any) {
          if (createErr.message.includes("Unknown attribute") && retryCount < maxRetries) {
            const attr = createErr.message.split('"')[1];
            if (attr && messageData[attr] !== undefined) {
              console.warn(`Self-healing (Message): Removing unknown attribute "${attr}" and retrying...`);
              delete messageData[attr];
              retryCount++;
              continue;
            }
          }
          throw createErr;
        }
      }
      res.json(message);
    } catch (error: any) {
      console.error("Message Creation Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/messages/:messageId", async (req, res) => {
    const { messageId } = req.params;
    const messageData = { ...req.body };
    try {
      let success = false;
      let retryCount = 0;
      const maxRetries = Object.keys(messageData).length;
      let message;

      while (!success && retryCount <= maxRetries) {
        try {
          message = await appwriteDatabases.updateDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.messages,
            messageId,
            messageData
          );
          success = true;
        } catch (updateErr: any) {
          if (updateErr.message.includes("Unknown attribute") && retryCount < maxRetries) {
            const attr = updateErr.message.split('"')[1];
            if (attr && messageData[attr] !== undefined) {
              console.warn(`Self-healing (Message Update): Removing unknown attribute "${attr}" and retrying...`);
              delete messageData[attr];
              retryCount++;
              continue;
            }
          }
          throw updateErr;
        }
      }
      res.json(message);
    } catch (error: any) {
      console.error("Message Update Error:", error.message);
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

  // Premium Request Routes
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

      // Send email notification
      if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS
          }
        });

        const mailOptions = {
          from: process.env.GMAIL_USER,
          to: 'munshidipa62@gmail.com',
          subject: `New Premium Request: ${plan}`,
          text: `User: ${userEmail}\nPlan: ${plan}\nMethod: ${paymentMethod}\nTransaction ID: ${transactionId}\nPhone: ${phoneNumber}`
        };

        transporter.sendMail(mailOptions).catch(e => console.error("Email error:", e));
      }

      res.json(doc);
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

  // User Management Routes
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

  app.patch("/api/users/:uid", async (req, res) => {
    const { uid } = req.params;
    const userData = { ...req.body };
    try {
      let success = false;
      let retryCount = 0;
      const maxRetries = Object.keys(userData).length;
      let doc;

      while (!success && retryCount <= maxRetries) {
        try {
          doc = await appwriteDatabases.updateDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.users,
            uid,
            userData
          );
          success = true;
        } catch (updateErr: any) {
          if (updateErr.message.includes("Unknown attribute") && retryCount < maxRetries) {
            const attr = updateErr.message.split('"')[1];
            if (attr && userData[attr] !== undefined) {
              console.warn(`Self-healing (Update): Removing unknown attribute "${attr}" and retrying...`);
              delete userData[attr];
              retryCount++;
              continue;
            }
          }
          throw updateErr;
        }
      }
      res.json(doc);
    } catch (error: any) {
      console.error("User Update Error:", error.message);
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

  // Stats Route
  app.get("/api/stats", async (req, res) => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Fetch global and daily stats
      const [globalDoc, dailyDoc] = await Promise.all([
        appwriteDatabases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.stats, 'global').catch(() => ({})),
        appwriteDatabases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.stats, `daily_${today}`).catch(() => ({}))
      ]);

      // Fetch users for counts
      const usersRes = await appwriteDatabases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.users,
        [Query.limit(5000)]
      );

      // Fetch total chats count
      const chatsRes = await appwriteDatabases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.chats,
        [Query.limit(1)]
      );

      // Fetch feedbacks for average rating
      const feedbackRes = await appwriteDatabases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.feedback,
        [Query.limit(5000)]
      );

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

  app.get("/api/test-appwrite", async (req, res) => {
    try {
      const result = await appwriteDatabases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.stats,
        [Query.limit(1)]
      );
      res.json({ success: true, message: "Appwrite connection successful", count: result.total });
    } catch (err: any) {
      console.error("[Appwrite Test] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
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

      // 4. Record Usage in Appwrite
      try {
        const today = new Date().toISOString().split('T')[0];
        
        const updateStats = async (docId: string) => {
          try {
            let doc;
            try {
              doc = await appwriteDatabases.getDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.stats,
                docId
              );
            } catch (err: any) {
              if (err.code === 404) {
                // Create if not exists
                await appwriteDatabases.createDocument(
                  APPWRITE_CONFIG.databaseId,
                  APPWRITE_CONFIG.collections.stats,
                  docId,
                  {
                    totalRequests: 1,
                    llamaTokens: llamaTokens,
                    serperRequests: context ? 1 : 0,
                    lastUpdated: new Date().toISOString(),
                    date: today
                  }
                );
                return;
              }
              throw err;
            }

            // Update existing
            await appwriteDatabases.updateDocument(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.stats,
              docId,
              {
                totalRequests: (doc.totalRequests || 0) + 1,
                llamaTokens: (doc.llamaTokens || 0) + llamaTokens,
                serperRequests: (doc.serperRequests || 0) + (context ? 1 : 0),
                lastUpdated: new Date().toISOString()
              }
            );
          } catch (innerErr: any) {
            console.error(`[Appwrite Stats] Error updating ${docId}:`, innerErr.message);
          }
        };

        await Promise.all([
          updateStats(`daily_${today}`),
          updateStats('global')
        ]);
        console.log("Usage stats updated in Appwrite");
      } catch (dbErr) {
        console.error("Failed to update stats in Appwrite:", dbErr);
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
