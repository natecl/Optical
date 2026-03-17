import test from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import {
  generateStepIllustration,
  __testing as illustrationTesting,
} from './illustrationService';

const createPngBuffer = (rgba: [number, number, number, number]): Buffer => {
  const png = new PNG({ width: 2, height: 2 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = rgba[0];
    png.data[i + 1] = rgba[1];
    png.data[i + 2] = rgba[2];
    png.data[i + 3] = rgba[3];
  }
  return PNG.sync.write(png);
};

test.beforeEach(() => {
  illustrationTesting.setImageGeneratorOverride(null);
  illustrationTesting.setRemoteImageGenerationDisabled(false);
});

test.afterEach(() => {
  illustrationTesting.setImageGeneratorOverride(null);
  illustrationTesting.setRemoteImageGenerationDisabled(false);
});

test('generateStepIllustration returns PNG for static steps', async () => {
  const png = createPngBuffer([255, 0, 0, 255]);

  illustrationTesting.setImageGeneratorOverride(async () => {
    return { buffer: png, format: 'png' };
  });

  const result = await generateStepIllustration('Let the dough rest');

  assert.equal(result?.format, 'png');
  assert.equal(result?.data, png.toString('base64'));
});

test('generateStepIllustration generates fresh illustration every call', async () => {
  const png = createPngBuffer([255, 0, 0, 255]);
  let callCount = 0;

  illustrationTesting.setImageGeneratorOverride(async () => {
    callCount += 1;
    return { buffer: png, format: 'png' };
  });

  await generateStepIllustration('Let the dough rest');
  await generateStepIllustration('Let the dough rest');

  assert.equal(callCount, 2);
});

test('generateStepIllustration returns GIF for motion steps with valid frames', async () => {
  const frames = [
    createPngBuffer([255, 0, 0, 255]),
    createPngBuffer([0, 255, 0, 255]),
    createPngBuffer([0, 0, 255, 255]),
  ];
  let frameIndex = 0;

  illustrationTesting.setImageGeneratorOverride(async () => ({
    buffer: frames[frameIndex++] ?? frames[0],
    format: 'png',
  }));

  const result = await generateStepIllustration('Slice the onions thinly');

  assert.equal(result?.format, 'gif');
  assert.ok(result && result.data.length > 0);
});

test('generateStepIllustration falls back to a local GIF when remote motion frames are unavailable', async () => {
  const png = createPngBuffer([200, 120, 40, 255]);
  let callCount = 0;

  illustrationTesting.setImageGeneratorOverride(async () => {
    callCount += 1;
    return callCount === 1 ? { buffer: png, format: 'png' } : null;
  });

  const result = await generateStepIllustration('Chop the herbs finely');

  assert.equal(result?.format, 'gif');
  assert.ok(result && result.data.length > 0);
});

test('extractGeneratedImage returns null for missing or invalid image parts', () => {
  const invalidSignature = Buffer.from('not-a-png').toString('base64');
  const missing = illustrationTesting.extractGeneratedImage([]);
  const wrongMime = illustrationTesting.extractGeneratedImage([
    { inlineData: { mimeType: 'image/jpeg', data: invalidSignature } },
  ]);
  const invalidPng = illustrationTesting.extractGeneratedImage([
    { inlineData: { mimeType: 'image/png', data: invalidSignature } },
  ]);

  assert.equal(missing, null);
  assert.equal(wrongMime, null);
  assert.equal(invalidPng, null);
});

test('generateStepIllustration falls back cleanly when a frame cannot be decoded', async () => {
  const png = createPngBuffer([80, 80, 220, 255]);
  let callCount = 0;

  illustrationTesting.setImageGeneratorOverride(async () => {
    callCount += 1;
    if (callCount === 1) return { buffer: png, format: 'png' };
    if (callCount === 2) return { buffer: Buffer.from('corrupt-frame'), format: 'png' };
    return null;
  });

  const result = await generateStepIllustration('Stir the sauce continuously');

  assert.equal(result?.format, 'gif');
  assert.ok(result && result.data.length > 0);
});

test('generateStepIllustration uses local fallback when remote generation is disabled', async () => {
  illustrationTesting.setRemoteImageGenerationDisabled(true);

  const result = await generateStepIllustration('Let the soup simmer');

  assert.equal(result?.format, 'png');
  assert.ok(result && result.data.length > 0);
});
