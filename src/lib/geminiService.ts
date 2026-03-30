import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// In Vite, environment variables must be prefixed with VITE_ to be accessible in the browser
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

if (!apiKey) {
  console.warn("VITE_GEMINI_API_KEY is not set. Gemini features will not work in the browser.");
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export async function generateSearchResponse(query: string, history: any[]) {
  if (!ai) {
    throw new Error("Gemini API Key is missing. Please set VITE_GEMINI_API_KEY in your environment variables.");
  }
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { role: "user", parts: [{ text: `You are Dibakar AI. Answer the following query accurately. Use markdown for formatting. Query: ${query}` }] }
      ],
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const answer = response.text || "I'm sorry, I couldn't generate an answer.";
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || "Source",
      link: chunk.web?.uri || "#",
      snippet: chunk.web?.title || ""
    })) || [];

    return { answer, sources };
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
}

export async function* generateSearchResponseStream(query: string, history: any[]) {
  if (!ai) {
    throw new Error("Gemini API Key is missing. Please set VITE_GEMINI_API_KEY in your environment variables.");
  }
  try {
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: [
        { role: "user", parts: [{ text: `You are Dibakar AI. Answer the following query accurately. Use markdown for formatting. Query: ${query}` }] }
      ],
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    let fullText = "";
    let sources: any[] = [];

    for await (const chunk of responseStream) {
      if (chunk.text) {
        fullText += chunk.text;
      }
      
      // Extract sources from the first chunk that has them (usually grounding metadata is in the final response or early chunks)
      if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks && sources.length === 0) {
        sources = chunk.candidates[0].groundingMetadata.groundingChunks.map((c: any) => ({
          title: c.web?.title || "Source",
          link: c.web?.uri || "#",
          snippet: c.web?.title || ""
        }));
      }

      yield { text: fullText, sources, done: false };
    }

    yield { text: fullText, sources, done: true };
  } catch (error) {
    console.error("Gemini Stream Error:", error);
    throw error;
  }
}

export async function generateChatTitle(firstMessage: string) {
  if (!ai) {
    return firstMessage.slice(0, 30);
  }
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { 
          role: "user", 
          parts: [{ 
            text: `Generate a very short, descriptive title (max 5 words) for a chat that starts with this message: "${firstMessage}". Return only the title text, no quotes or extra words.` 
          }] 
        }
      ]
    });

    return response.text?.trim() || firstMessage.slice(0, 30);
  } catch (error) {
    console.error("Title Generation Error:", error);
    return firstMessage.slice(0, 30);
  }
}
