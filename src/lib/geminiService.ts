import { SearchResponse } from "../types";

/**
 * Calls the backend API to generate a search response using Groq and Serper.
 */
export async function generateSearchResponse(query: string, history: any[]): Promise<SearchResponse> {
  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, history }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to generate search response");
    }

    const data = await response.json();
    return {
      answer: data.answer,
      sources: data.sources || []
    };
  } catch (error) {
    console.error("Search API Error:", error);
    throw error;
  }
}

/**
 * Placeholder for streaming search response. 
 * Since the current backend doesn't support streaming, we'll simulate it or just return the full response.
 */
export async function* generateSearchResponseStream(query: string, history: any[]) {
  try {
    const result = await generateSearchResponse(query, history);
    
    // Simulate streaming by yielding the full text in one go
    yield { text: result.answer, sources: result.sources, done: true };
  } catch (error) {
    console.error("Search Stream Error:", error);
    throw error;
  }
}

/**
 * Calls the backend API to generate a chat title.
 */
export async function generateChatTitle(firstMessage: string): Promise<string> {
  try {
    const response = await fetch("/api/title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: firstMessage }),
    });

    if (!response.ok) {
      return firstMessage.slice(0, 30);
    }

    const data = await response.json();
    return data.title || firstMessage.slice(0, 30);
  } catch (error) {
    console.error("Title Generation Error:", error);
    return firstMessage.slice(0, 30);
  }
}
