export enum AspectRatio {
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
}

export interface VideoSegment {
  id: string;
  text: string;
  imagePrompt: string;
  imageData: string; // base64
  audioData: string; // base64
  duration: number; // approximate duration in seconds
}

export interface GeneratedVideo {
  id: string;
  topic: string;
  style: string;
  aspectRatio: AspectRatio;
  segments: VideoSegment[];
  timestamp: number;
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  PLANNING = 'PLANNING',
  GENERATING_ASSETS = 'GENERATING_ASSETS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}