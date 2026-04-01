import { Hono } from 'hono';
import { cors } from 'hono/cors';
import Groq from "groq-sdk";

type Bindings = {
  GROQ_API_KEY: string;
  SERPER_API_KEY: string;
}

const app = new Hono<{ Bindings: Bindings }>();

// CORS for Cloudflare
app.use('/api/*', cors({
  origin: '*', // Change this to your Pages URL for security
  allowMethods: ['POST', 'GET', 'OPTIONS'],
}));

// Health Check
app.get('/api/health', (c) => {
  return c.json({ status: "ok", environment: "cloudflare-workers" });
});

// Title API
app.post('/api/title', async (c) => {
  const { query } = await c.req.json();
  const GROQ_API_KEY = c.env.GROQ_API_KEY;

  if (!GROQ_API_KEY) return c.json({ error: "API key missing" }, 500);

  const groq = new Groq({ apiKey: GROQ_API_KEY });

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "Tu ek AI hai jo user ke query ke liye ek chota (max 4-5 words) title generate karta hai. Sirf title de, aur kuch nahi." },
        { role: "user", content: query }
      ],
      model: "llama-3.1-8b-instant",
    });
    return c.json({ title: completion.choices[0]?.message?.content?.replace(/"/g, '') || "New Chat" });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Search API
app.post('/api/search', async (c) => {
  const { query, history = [] } = await c.req.json();
  const GROQ_API_KEY = c.env.GROQ_API_KEY;
  const SERPER_API_KEY = c.env.SERPER_API_KEY;

  if (!GROQ_API_KEY || !SERPER_API_KEY) {
    return c.json({ error: "API keys are missing" }, 500);
  }

  const groq = new Groq({ apiKey: GROQ_API_KEY });

  try {
    // 1. Serper Search using native fetch
    const serperRes = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: query, num: 3 })
    });

    const serperData: any = await serperRes.json();
    const sources = serperData.organic || [];
    let context = sources.map((s: any) => `Title: ${s.title}\nContent: ${s.snippet}`).join("\n\n");

    // 2. Groq Completion
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: `Tu Dibakar AI Brain hai. Context: ${context}` },
        ...history,
        { role: "user", content: query }
      ],
      model: "llama-3.1-8b-instant",
    });

    return c.json({
      answer: completion.choices[0]?.message?.content,
      sources: sources.map((s: any) => ({ title: s.title, link: s.link }))
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Premium Request API (Placeholder for Email)
app.post('/api/premium-request', async (c) => {
  const { email, name, message } = await c.req.json();
  console.log(`Premium request from ${name} (${email}): ${message}`);
  return c.json({ success: true, message: "Request received! We will contact you soon." });
});

export default app;
