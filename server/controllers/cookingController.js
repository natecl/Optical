const {
  createSession,
  getSession,
  sendEvent,
  CookingSessionError
} = require('../services/cookingSessionService');
const { notifyStepChange } = require('../ws/cookingLiveServer');

const postCreateSession = (req, res) => {
  try {
    const { recipe } = req.body || {};
    const session = createSession(recipe);
    res.status(201).json(session);
  } catch (error) {
    if (error instanceof CookingSessionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to create cooking session' });
  }
};

const getSessionById = (req, res) => {
  const { sessionId } = req.params;
  const session = getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Cooking session not found' });
    return;
  }
  res.status(200).json(session);
};

const postSessionEvent = (req, res) => {
  try {
    const { sessionId } = req.params;
    const event = req.body;
    const previousSession = getSession(sessionId);
    const previousStep = previousSession?.currentStepIndex;

    const updatedSession = sendEvent(sessionId, event);

    // Notify RamseyBot if the step changed
    if (
      updatedSession.currentStepIndex !== previousStep &&
      updatedSession.status === 'active'
    ) {
      const stepText = updatedSession.recipe.instructions[updatedSession.currentStepIndex];
      if (stepText) {
        notifyStepChange(sessionId, updatedSession.currentStepIndex, stepText);
      }
    }

    res.status(200).json(updatedSession);
  } catch (error) {
    if (error instanceof CookingSessionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to process cooking event' });
  }
};

module.exports = {
  postCreateSession,
  getSessionById,
  postSessionEvent
};
