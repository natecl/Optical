import test from 'node:test';
import assert from 'node:assert/strict';
import type { Recipe } from '../../types/recipe';
import { createSession, sendEvent } from './cookingSessionService';

const recipe: Recipe = {
  recipe_name: 'Regression Test Recipe',
  ingredients: ['ingredient'],
  instructions: ['Step 1', 'Step 2', 'Step 3'],
};

test('going to previous step re-enables completion flow', () => {
  const session = createSession(recipe);

  const started = sendEvent(session.sessionId, { type: 'START_COOKING' });
  assert.equal(started.currentStepIndex, 0);
  assert.deepEqual(started.stepCompletion, [false, false, false]);

  const afterComplete = sendEvent(session.sessionId, { type: 'MARK_STEP_COMPLETE' });
  assert.equal(afterComplete.currentStepIndex, 1);
  assert.deepEqual(afterComplete.stepCompletion, [true, false, false]);

  const afterPrevious = sendEvent(session.sessionId, { type: 'PREVIOUS_STEP' });
  assert.equal(afterPrevious.currentStepIndex, 0);
  assert.deepEqual(afterPrevious.stepCompletion, [false, false, false]);

  const completeAgain = sendEvent(session.sessionId, { type: 'MARK_STEP_COMPLETE' });
  assert.equal(completeAgain.currentStepIndex, 1);
  assert.deepEqual(completeAgain.stepCompletion, [true, false, false]);
});
