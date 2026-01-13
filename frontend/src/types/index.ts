export interface Apartment {
  id: string;
  district: string;
  area: number;
  floor: number;
  price: number;
  description: string;
  images: string[];
}

export interface ChatResponse {
  userText: string;
  response: string;
  audio: string;
  action: string;
  apartment?: Apartment;
  landingUrl?: string;
  params: Record<string, unknown>;
}

export interface SessionStartResponse {
  sessionId: string;
  greeting: string;
  audio: string;
}

export type CallState = 'idle' | 'connecting' | 'active' | 'ended';
export type SpeakingState = 'idle' | 'user' | 'assistant';

