const ACTIVE_COOKING_SESSION_KEY = 'cookmate-active-cooking-session';

const normalizeSessionId = (sessionId: string | null | undefined): string | null => {
  if (typeof sessionId !== 'string') {
    return null;
  }

  const trimmedSessionId = sessionId.trim();
  return trimmedSessionId ? trimmedSessionId : null;
};

export const buildCookingPath = (sessionId: string): string => {
  const params = new URLSearchParams({ sessionId });
  return `/cooking?${params.toString()}`;
};

export const getResumableSessionId = (
  search: string,
  storedSessionId: string | null | undefined
): string | null => {
  const searchParams = new URLSearchParams(search);
  return normalizeSessionId(searchParams.get('sessionId')) || normalizeSessionId(storedSessionId);
};

export const shouldResumeCookingSession = (
  sessionId: string | null | undefined,
  hasRecipeState: boolean
): boolean => Boolean(normalizeSessionId(sessionId) && !hasRecipeState);

export const readPersistedCookingSessionId = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return normalizeSessionId(window.sessionStorage.getItem(ACTIVE_COOKING_SESSION_KEY));
};

export const persistCookingSessionId = (sessionId: string): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(ACTIVE_COOKING_SESSION_KEY, sessionId);
};

export const clearPersistedCookingSessionId = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(ACTIVE_COOKING_SESSION_KEY);
};
