import { SearchSource } from "../types";

export async function processAIRequest(
  input: string,
  onChunk: (text: string) => void,
  onSources?: (sources: SearchSource[]) => void
) {
  try {
    const response = await fetch('/api/ai/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: input })
    });

    if (!response.ok) {
      throw new Error('Failed to connect to AI server');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');

    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') break;

          try {
            const data = JSON.parse(dataStr);
            if (data.text) {
              fullText += data.text;
              onChunk(fullText);
            }
            if (data.sources && onSources) {
              onSources(data.sources);
            }
            if (data.error) {
              throw new Error(data.error);
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    }
  } catch (error: any) {
    console.error('AI Request Error:', error);
    onChunk(`Error: ${error.message || 'Something went wrong while connecting to the brain.'}`);
  }
}
