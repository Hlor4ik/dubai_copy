import { DialogueContext, SessionAnalytics } from '../types/index.js';

// In-memory storage для демо
const sessions: Map<string, SessionAnalytics> = new Map();

export function startSession(sessionId: string): void {
  const analytics: SessionAnalytics = {
    sessionId,
    startTime: Date.now(),
    params: {},
    apartmentsShown: 0,
    landingGenerated: false,
  };
  sessions.set(sessionId, analytics);
}

export function updateSession(context: DialogueContext): void {
  const session = sessions.get(context.sessionId);
  if (session) {
    session.params = context.params;
    session.apartmentsShown = context.shownApartments.length;
    if (context.selectedApartment) {
      session.selectedApartment = context.selectedApartment;
    }
  }
}

export function markLandingGenerated(sessionId: string, apartmentId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.landingGenerated = true;
    session.selectedApartment = apartmentId;

  }
}

export function endSession(sessionId: string): SessionAnalytics | undefined {
  const session = sessions.get(sessionId);
  if (session) {
    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;
    return session;
  }
  return undefined;
}

export function getSession(sessionId: string): SessionAnalytics | undefined {
  return sessions.get(sessionId);
}

export function getAllSessions(): SessionAnalytics[] {
  return Array.from(sessions.values());
}

