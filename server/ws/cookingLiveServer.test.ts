import test from 'node:test';
import assert from 'node:assert/strict';
import type { WebSocket } from 'ws';
import type { Recipe } from '../../types/recipe';
import type { ActiveCookingSession, CookingLiveServerMessage } from '../../types/websocket';
import { __testing as cookingLiveTesting } from './cookingLiveServer';

const recipe: Recipe = {
  recipe_name: 'Test Recipe',
  ingredients: ['onion'],
  instructions: ['Slice the onion', 'Cook the onion'],
};

const createSocketDouble = (): {
  socket: WebSocket;
  getMessages: () => CookingLiveServerMessage[];
} => {
  const payloads: CookingLiveServerMessage[] = [];
  const socket = {
    readyState: 1,
    send(payload: string) {
      payloads.push(JSON.parse(payload) as CookingLiveServerMessage);
    },
  } as unknown as WebSocket;

  return {
    socket,
    getMessages: () => payloads,
  };
};

const createEntry = (stepIndex: number): ActiveCookingSession => ({
  geminiSession: {},
  clientSocket: {} as WebSocket,
  currentStepIndex: stepIndex,
  recipe,
});

test('requestStepIllustration emits loading and error when generation returns null', async () => {
  const { socket, getMessages } = createSocketDouble();

  await cookingLiveTesting.requestStepIllustration({
    socket,
    cookingSessionId: 'cook_1',
    stepIndex: 0,
    stepText: recipe.instructions[0],
    recipe,
    getEntry: () => createEntry(0),
    generateIllustration: async () => null,
  });

  assert.deepEqual(
    getMessages().map((message) => message.type),
    ['live:illustration_loading', 'live:illustration_error']
  );
});

test('requestStepIllustration emits loading and error when generation throws', async () => {
  const { socket, getMessages } = createSocketDouble();

  await cookingLiveTesting.requestStepIllustration({
    socket,
    cookingSessionId: 'cook_2',
    stepIndex: 1,
    stepText: recipe.instructions[1],
    recipe,
    getEntry: () => createEntry(1),
    generateIllustration: async () => {
      throw new Error('boom');
    },
  });

  assert.deepEqual(
    getMessages().map((message) => message.type),
    ['live:illustration_loading', 'live:illustration_error']
  );
});

test('requestStepIllustration emits loading and image when generation succeeds', async () => {
  const { socket, getMessages } = createSocketDouble();

  await cookingLiveTesting.requestStepIllustration({
    socket,
    cookingSessionId: 'cook_3',
    stepIndex: 0,
    stepText: recipe.instructions[0],
    recipe,
    getEntry: () => createEntry(0),
    generateIllustration: async () => ({ data: 'abc123', format: 'png' }),
  });

  assert.deepEqual(
    getMessages().map((message) => message.type),
    ['live:illustration_loading', 'live:illustration']
  );
});
