import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import { Groq } from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const GROQ_API_KEY = "Gsk_wSXGJCfqZiwUQZ4BuNlpWGdyb3FYnAqh5bBys0nvSNPYbXG1jFNy";
const SERPER_API_KEY = "2721257bb1186023cd56b12c503d1df3fa2242a9";

const groq = new Groq({ apiKey: GROQ_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/search", async (req, res) => {
    const { query, history = [] } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    try {
      // 1. Check if it's a simple greeting
      const lowerQuery = query.toLowerCase().trim();
      const greetings = ["hi", "hello", "hey", "namaste", "salaam"];
      const isGreeting = greetings.some(g => lowerQuery === g || lowerQuery.startsWith(g + " "));

      let context = "";
      let sources: any[] = [];

      if (!isGreeting) {
        // 2. Call Serper.dev
        const serperRes = await axios.post(
          "https://google.serper.dev/search",
          { q: query, num: 3 },
          { headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" } }
        );

        sources = serperRes.data.organic || [];
        context = sources
          .map((s: any, i: number) => `Source [${i + 1}]: ${s.title}\nURL: ${s.link}\nSnippet: ${s.snippet}`)
          .join("\n\n");
      }

      // 3. Call Groq (Llama-3)
      const systemInstruction = `You are Dibakar AI. Synthesize the web context into a structured, accurate answer using markdown. Always reply in the exact same language the user typed in (Hindi, Bengali, or English). Put the source links at the end.
      
      Context:
      ${context || "No web context needed for this query."}`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemInstruction },
          ...history.map((h: any) => ({ role: h.role, content: h.content })),
          { role: "user", content: query },
        ],
        model: "llama3-8b-8192",
      });

      const answer = chatCompletion.choices[0]?.message?.content || "I'm sorry, I couldn't generate an answer.";

      res.json({
        answer,
        sources: sources.map(s => ({ title: s.title, link: s.link, snippet: s.snippet }))
      });
    } catch (error: any) {
      console.error("Search API Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to process search" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
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
