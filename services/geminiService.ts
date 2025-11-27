import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AspectRatio, VideoSegment, GeneratedVideo } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found. Please select a key.");
  }
  return new GoogleGenAI({ apiKey });
};

// 1. Generate the Script and Visual Plan
const generateScript = async (topic: string, style: string, isShorts: boolean) => {
  const ai = getClient();
  const model = 'gemini-2.5-flash';
  
  const format = isShorts ? "YouTube Short (under 60s, fast paced)" : "YouTube Video (engaging, informative)";
  
  const prompt = `You are an expert YouTube video creator. Create a script for a ${format} about: "${topic}".
  Style: ${style}.
  
  Return a JSON object containing a list of exactly 5 scenes.
  Each scene must have:
  - "narration": The spoken text (keep it punchy and engaging, max 15 words per scene).
  - "visual_prompt": A highly detailed description to generate a photorealistic, cinematic image for this scene. Avoid text in the image description.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                narration: { type: Type.STRING },
                visual_prompt: { type: Type.STRING },
              },
              required: ["narration", "visual_prompt"]
            }
          }
        }
      }
    }
  });

  const json = JSON.parse(response.text || "{}");
  return json.scenes || [];
};

// 2. Generate Image Asset
const generateImage = async (prompt: string, aspectRatio: AspectRatio) => {
  const ai = getClient();
  // Using Flash Image for speed and free-tier availability where applicable
  const model = 'gemini-2.5-flash-image'; 
  
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      // Flash Image doesn't support aspect ratio config in the same way as Veo/Imagen sometimes,
      // but we can try to influence it via prompt or just crop client side.
      // However, let's try standard image config if supported by the SDK for this model.
      // Note: gemini-2.5-flash-image is often simpler.
      // We will rely on client-side cropping (object-fit: cover) for the video player to ensure it fills the screen.
    }
  });

  // Extract image
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return part.inlineData.data;
    }
  }
  throw new Error("No image generated");
};

// 3. Generate Audio Asset
const generateAudio = async (text: string) => {
  const ai = getClient();
  const model = 'gemini-2.5-flash-preview-tts';

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }, // 'Kore' is usually good for narration
        },
      },
    },
  });

  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) throw new Error("No audio generated");
  return audioData;
};

// Main Workflow
export const generateVideoWorkflow = async (
  topic: string,
  style: string,
  aspectRatio: AspectRatio,
  onProgress: (msg: string) => void
): Promise<GeneratedVideo> => {
  
  onProgress("Planning video script & visuals...");
  const scenes = await generateScript(topic, style, aspectRatio === AspectRatio.PORTRAIT);
  
  const segments: VideoSegment[] = [];
  
  // Process scenes sequentially to avoid rate limits on free tier, 
  // or parallel if we feel brave. Sequential is safer for "No Money" (Free Tier limits).
  let i = 0;
  for (const scene of scenes) {
    i++;
    onProgress(`Generating Scene ${i}/${scenes.length}: Visuals...`);
    
    // Add style keywords to image prompt
    const enhancedPrompt = `${scene.visual_prompt}, ${style} style, 8k, photorealistic, cinematic lighting, no text`;
    
    // Generate Image
    const imageData = await generateImage(enhancedPrompt, aspectRatio);
    
    onProgress(`Generating Scene ${i}/${scenes.length}: Voiceover...`);
    // Generate Audio
    const audioData = await generateAudio(scene.narration);
    
    // Estimate duration (rough guess if we can't decode yet, but player will handle actual duration)
    // We'll update duration in the player.
    segments.push({
      id: `seg-${Date.now()}-${i}`,
      text: scene.narration,
      imagePrompt: scene.visual_prompt,
      imageData,
      audioData,
      duration: 5, // Default, will be updated by player based on audio length
    });
  }

  return {
    id: Date.now().toString(),
    topic,
    style,
    aspectRatio,
    segments,
    timestamp: Date.now(),
  };
};