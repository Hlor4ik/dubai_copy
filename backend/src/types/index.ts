export interface Apartment {
  id: string;
  name?: string;
  district: string;
  area: number;
  floor: number;
  price: number;
  description: string;
  images: string[];
  bedrooms?: number;
  bathrooms?: number;
  features?: string[];
}

export interface SearchParams {
  district?: string;
  price_min?: number;
  price_max?: number;
  area_min?: number;
  area_max?: number;
  floor_min?: number;
  floor_max?: number;
}

export interface DialogueContext {
  sessionId: string;
  params: SearchParams;
  shownApartments: string[];
  selectedApartment?: string;
  messageHistory: ChatMessage[];
  startTime: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SessionAnalytics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  params: SearchParams;
  apartmentsShown: number;
  selectedApartment?: string;
  landingGenerated: boolean;
}

