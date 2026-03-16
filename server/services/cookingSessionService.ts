import { CookingSessionError } from '../../types/errors';
import type { SessionStatus, SessionEventType, CookingSession } from '../../types/session';
import type { Recipe } from '../../types/recipe';

interface SessionEvent {
  type: string;
  stepIndex?: number;
}

type TransitionResult = CookingSession | { error: string };

const sessions = new Map<string, CookingSession>();

const VALID_TRANSITIONS: Record<SessionStatus, SessionEventType[]> = {
  idle: ['START_COOKING'],
  active: ['NEXT_STEP', 'PREVIOUS_STEP', 'MARK_STEP_COMPLETE', 'GO_TO_STEP', 'PAUSE_SESSION', 'FINISH_SESSION', 'RESET_SESSION'],
  paused: ['RESUME_SESSION', 'RESET_SESSION', 'FINISH_SESSION'],
  completed: ['RESET_SESSION']
};

const transition = (session: CookingSession, event: SessionEvent): TransitionResult => {
  const { type } = event;
  const allowed: string[] = VALID_TRANSITIONS[session.status] || [];

  if (!allowed.includes(type)) {
    return { error: `Event "${type}" is not valid in status "${session.status}"` };
  }

  const now = new Date().toISOString();
  const totalSteps = session.recipe.instructions.length;

  switch (type) {
    case 'START_COOKING':
      return {
        ...session,
        status: 'active',
        currentStepIndex: 0,
        stepCompletion: session.recipe.instructions.map(() => false),
        updatedAt: now
      };

    case 'NEXT_STEP': {
      const nextIndex = Math.min(session.currentStepIndex + 1, totalSteps - 1);
      return { ...session, currentStepIndex: nextIndex, updatedAt: now };
    }

    case 'PREVIOUS_STEP': {
      const prevIndex = Math.max(session.currentStepIndex - 1, 0);
      const newCompletion = [...session.stepCompletion];
      newCompletion[prevIndex] = false;
      return {
        ...session,
        currentStepIndex: prevIndex,
        stepCompletion: newCompletion,
        updatedAt: now
      };
    }

    case 'MARK_STEP_COMPLETE': {
      const newCompletion = [...session.stepCompletion];
      newCompletion[session.currentStepIndex] = true;
      let nextIndex = session.currentStepIndex;
      if (session.currentStepIndex < totalSteps - 1) {
        nextIndex = session.currentStepIndex + 1;
      }
      return {
        ...session,
        stepCompletion: newCompletion,
        currentStepIndex: nextIndex,
        updatedAt: now
      };
    }

    case 'GO_TO_STEP': {
      const target = event.stepIndex;
      if (typeof target !== 'number' || target < 0 || target >= totalSteps) {
        return { error: `Invalid stepIndex: ${target}` };
      }
      return { ...session, currentStepIndex: target, updatedAt: now };
    }

    case 'PAUSE_SESSION':
      return { ...session, status: 'paused', updatedAt: now };

    case 'RESUME_SESSION':
      return { ...session, status: 'active', updatedAt: now };

    case 'FINISH_SESSION':
      return { ...session, status: 'completed', updatedAt: now };

    case 'RESET_SESSION':
      return {
        ...session,
        status: 'idle',
        currentStepIndex: 0,
        stepCompletion: session.recipe.instructions.map(() => false),
        updatedAt: now
      };

    default:
      return { error: `Unknown event type: ${type}` };
  }
};

export const createSession = (recipe: Recipe): CookingSession => {
  if (!recipe || typeof recipe !== 'object') {
    throw new CookingSessionError('Recipe is required', 400);
  }
  if (!recipe.recipe_name || typeof recipe.recipe_name !== 'string') {
    throw new CookingSessionError('recipe_name must be a non-empty string', 400);
  }
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    throw new CookingSessionError('ingredients must be a non-empty array', 400);
  }
  if (!Array.isArray(recipe.instructions) || recipe.instructions.length === 0) {
    throw new CookingSessionError('instructions must be a non-empty array', 400);
  }

  const now = new Date().toISOString();
  const sessionId = `cook_${Date.now()}`;
  const session: CookingSession = {
    sessionId,
    recipe,
    currentStepIndex: 0,
    stepCompletion: recipe.instructions.map(() => false),
    status: 'idle',
    createdAt: now,
    updatedAt: now
  };

  sessions.set(sessionId, session);
  return session;
};

export const getSession = (sessionId: string): CookingSession | null => {
  return sessions.get(sessionId) || null;
};

export const sendEvent = (sessionId: string, event: SessionEvent): CookingSession => {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new CookingSessionError('Cooking session not found', 404);
  }

  if (!event || typeof event.type !== 'string') {
    throw new CookingSessionError('Event must have a "type" string property', 400);
  }

  const result = transition(session, event);

  if ('error' in result) {
    throw new CookingSessionError(result.error, 400);
  }

  sessions.set(sessionId, result);
  return result;
};

export { CookingSessionError };
