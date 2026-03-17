import { GoogleGenAI } from '@google/genai';
import GIFEncoder from 'gif-encoder-2';
import { PNG } from 'pngjs';
import type { IllustrationResult } from '../../../types/illustration';

const IMAGE_MODEL = 'gemini-2.5-flash-image';
const STYLE_PREFIX =
  'A detailed, charming 3D cartoon cooking illustration in an isometric perspective, like a high-quality animated movie still. Objects should look three-dimensional with rounded, tactile forms — plump vegetables, glossy sauces, chunky wooden cutting boards with visible grain, gleaming stainless steel knives. Use soft volumetric lighting with gentle shadows and ambient occlusion to give depth. The style should be stylized and friendly but highly descriptive and instructional — clearly showing the exact technique, hand positions, ingredient quantities, and tool angles so a beginner cook can follow along. Use a warm earthy color palette of rich browns, vibrant greens, soft creams, terracotta, and golden highlights. Every ingredient and tool should be clearly identifiable and accurately proportioned. No text, no labels, no watermarks. Scene:';

const FRAME_COUNT = 3;
const GIF_DELAY = 900;
const CANVAS_SIZE = 320;

const WHITE: [number, number, number, number] = [255, 252, 247, 255];
const INK: [number, number, number, number] = [52, 37, 25, 255];
const BOARD: [number, number, number, number] = [225, 199, 163, 255];
const ACCENT: [number, number, number, number] = [210, 115, 46, 255];
const GREEN: [number, number, number, number] = [107, 153, 78, 255];
const RED: [number, number, number, number] = [204, 84, 76, 255];
const GRAY: [number, number, number, number] = [117, 126, 140, 255];
const GOLD: [number, number, number, number] = [245, 184, 78, 255];
const BLUE: [number, number, number, number] = [95, 137, 198, 255];

type StillImageFormat = Exclude<IllustrationResult['format'], 'gif'>;

interface StillImageResult {
  buffer: Buffer;
  format: StillImageFormat;
}

interface GeneratedImagePart {
  inlineData?: {
    data?: string;
    mimeType?: string;
  };
}

interface DecodedPngFrame {
  width: number;
  height: number;
  data: Buffer;
  source: Buffer;
}

type ImageGenerator = (prompt: string) => Promise<StillImageResult | null>;
type SceneKind = 'cut' | 'mix' | 'pour' | 'heat' | 'knead' | 'plate';

let client: GoogleGenAI | undefined;
let imageGeneratorOverride: ImageGenerator | null = null;
let remoteImageGenerationDisabled = false;

const MOTION_KEYWORDS = [
  'slice', 'cut', 'chop', 'dice', 'mince', 'julienne', 'trim',
  'stir', 'whisk', 'beat', 'mix', 'fold', 'toss', 'blend',
  'knead', 'roll', 'flatten', 'shape', 'press', 'stretch',
  'flip', 'turn', 'sear', 'sauté', 'saute', 'fry', 'grill',
  'pour', 'drizzle', 'spread', 'layer', 'stuff', 'wrap',
  'peel', 'grate', 'shred', 'zest', 'crack', 'squeeze',
  'brush', 'baste', 'glaze', 'score', 'carve',
];

const getClient = (): GoogleGenAI => {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key is missing');
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
};

function isMotionStep(stepText: string): boolean {
  const lower = stepText.toLowerCase();
  return MOTION_KEYWORDS.some((kw) => lower.includes(kw));
}

function normalizeFormat(mimeType: string | undefined, buffer: Buffer): StillImageFormat | null {
  const isPng = buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = buffer.length >= 3
    && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp = buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (mimeType === 'image/png') return isPng ? 'png' : null;
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return isJpeg ? 'jpeg' : null;
  if (mimeType === 'image/webp') return isWebp ? 'webp' : null;

  if (isPng) {
    return 'png';
  }
  if (isJpeg) {
    return 'jpeg';
  }
  if (isWebp) {
    return 'webp';
  }

  return null;
}

function extractGeneratedImage(parts: GeneratedImagePart[]): StillImageResult | null {
  for (const part of parts) {
    const inlineData = part.inlineData;
    if (!inlineData?.data) {
      continue;
    }

    const buffer = Buffer.from(inlineData.data, 'base64');
    const format = normalizeFormat(inlineData.mimeType, buffer);
    if (!format) {
      console.warn('[IllustrationService] Ignoring unsupported image part:', inlineData.mimeType || 'unknown');
      continue;
    }

    return { buffer, format };
  }

  return null;
}

async function generateSingleImage(prompt: string): Promise<StillImageResult | null> {
  if (imageGeneratorOverride) {
    return imageGeneratorOverride(prompt);
  }

  if (remoteImageGenerationDisabled) {
    return null;
  }

  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: 'user', parts: [{ text: `${STYLE_PREFIX} ${prompt}` }] }],
      config: {
        responseModalities: ['IMAGE'],
      },
    });

    const candidates = response.candidates ?? [];
    for (const candidate of candidates) {
      const image = extractGeneratedImage((candidate.content?.parts ?? []) as GeneratedImagePart[]);
      if (image) {
        return image;
      }
    }

    console.warn('[IllustrationService] No usable image returned by model');
    return null;
  } catch (err) {
    const message = (err as Error).message;
    if (/RESOURCE_EXHAUSTED|quota|429/i.test(message)) {
      remoteImageGenerationDisabled = true;
      console.warn('[IllustrationService] Remote image generation disabled for this process:', message);
    } else {
      console.error('[IllustrationService] Image gen failed:', message);
    }
    return null;
  }
}

function decodePng(buffer: Buffer): DecodedPngFrame | null {
  try {
    const png = PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: png.data, source: buffer };
  } catch (err) {
    console.warn('[IllustrationService] Failed to decode PNG frame:', (err as Error).message);
    return null;
  }
}

function stitchGif(frames: DecodedPngFrame[]): Buffer | null {
  try {
    const first = frames[0];
    const encoder = new GIFEncoder(first.width, first.height);
    encoder.setDelay(GIF_DELAY);
    encoder.setRepeat(0);
    encoder.setQuality(10);
    encoder.start();
    encoder.addFrame(first.data);

    for (let i = 1; i < frames.length; i++) {
      const frame = frames[i];
      if (frame.width === first.width && frame.height === first.height) {
        encoder.addFrame(frame.data);
      }
    }

    encoder.finish();
    return encoder.out.getData();
  } catch (err) {
    console.error('[IllustrationService] GIF stitch failed:', (err as Error).message);
    return null;
  }
}

function createCanvas(): PNG {
  const png = new PNG({ width: CANVAS_SIZE, height: CANVAS_SIZE });
  fillRect(png, 0, 0, CANVAS_SIZE, CANVAS_SIZE, WHITE);
  return png;
}

function setPixel(png: PNG, x: number, y: number, color: [number, number, number, number]): void {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) {
    return;
  }
  const index = (png.width * y + x) << 2;
  png.data[index] = color[0];
  png.data[index + 1] = color[1];
  png.data[index + 2] = color[2];
  png.data[index + 3] = color[3];
}

function fillRect(
  png: PNG,
  x: number,
  y: number,
  width: number,
  height: number,
  color: [number, number, number, number]
): void {
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(png.width, Math.ceil(x + width));
  const endY = Math.min(png.height, Math.ceil(y + height));

  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      setPixel(png, px, py, color);
    }
  }
}

function drawCircle(
  png: PNG,
  cx: number,
  cy: number,
  radius: number,
  color: [number, number, number, number]
): void {
  const minX = Math.floor(cx - radius);
  const maxX = Math.ceil(cx + radius);
  const minY = Math.floor(cy - radius);
  const maxY = Math.ceil(cy + radius);

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const dx = px - cx;
      const dy = py - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(png, px, py, color);
      }
    }
  }
}

function drawLine(
  png: PNG,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: [number, number, number, number],
  thickness = 2
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) {
    drawCircle(png, x1, y1, thickness, color);
    return;
  }

  for (let i = 0; i <= steps; i++) {
    const x = x1 + (dx * i) / steps;
    const y = y1 + (dy * i) / steps;
    drawCircle(png, x, y, thickness, color);
  }
}

function drawBoard(png: PNG): void {
  fillRect(png, 45, 105, 230, 125, BOARD);
  fillRect(png, 58, 118, 204, 99, [239, 216, 180, 255]);
}

function inferScene(stepText: string): SceneKind {
  const lower = stepText.toLowerCase();
  if (/(slice|cut|chop|dice|mince|julienne|trim|grate|shred|zest|carve)/.test(lower)) return 'cut';
  if (/(stir|whisk|beat|mix|fold|toss|blend)/.test(lower)) return 'mix';
  if (/(pour|drizzle|spread|layer|glaze|baste|brush)/.test(lower)) return 'pour';
  if (/(knead|roll|flatten|shape|press|stretch|wrap)/.test(lower)) return 'knead';
  if (/(sear|saute|sauté|fry|grill|flip|turn|cook|heat)/.test(lower)) return 'heat';
  return 'plate';
}

function renderScene(png: PNG, scene: SceneKind, frameIndex: number): void {
  const motion = frameIndex - 1;

  if (scene === 'cut') {
    drawBoard(png);
    drawCircle(png, 125 + motion * 10, 170, 24, GREEN);
    drawCircle(png, 162 + motion * 8, 170, 18, GREEN);
    fillRect(png, 92, 148, 8, 44, RED);
    drawLine(png, 214, 122 + motion * 7, 140, 198 + motion * 4, GRAY, 5);
    fillRect(png, 216, 116 + motion * 7, 34, 16, INK);
    drawLine(png, 236, 150, 236 + motion * 8, 200 + motion * 6, ACCENT, 3);
  } else if (scene === 'mix') {
    drawCircle(png, 160, 175, 62, [240, 232, 225, 255]);
    drawCircle(png, 160, 175, 52, BLUE);
    drawLine(png, 155 + motion * 9, 105, 175 - motion * 6, 190, GRAY, 5);
    drawCircle(png, 160 + motion * 12, 158, 14, GOLD);
    drawCircle(png, 140 - motion * 9, 186, 12, RED);
    drawLine(png, 115, 135, 205, 135 + motion * 7, WHITE, 3);
    drawLine(png, 116, 205, 204, 205 - motion * 7, WHITE, 3);
  } else if (scene === 'pour') {
    fillRect(png, 70, 92, 78, 56, GRAY);
    fillRect(png, 84, 82, 18, 18, INK);
    drawLine(png, 146, 135, 178 + motion * 5, 165 + motion * 12, GOLD, 4);
    drawLine(png, 178 + motion * 5, 165 + motion * 12, 198 + motion * 5, 205, GOLD, 4);
    fillRect(png, 180, 200, 82, 26, BLUE);
    drawLine(png, 182, 198, 258, 198, INK, 2);
    drawCircle(png, 214, 180 + motion * 3, 10, ACCENT);
  } else if (scene === 'heat') {
    fillRect(png, 94, 188, 132, 20, INK);
    fillRect(png, 120, 208, 80, 12, GRAY);
    drawLine(png, 225, 198, 266, 186 + motion * 4, GRAY, 6);
    fillRect(png, 118, 212, 12, 10, RED);
    fillRect(png, 150, 208 - motion * 5, 14, 18 + motion * 5, GOLD);
    fillRect(png, 186, 210 - motion * 3, 14, 16 + motion * 3, ACCENT);
    drawCircle(png, 145 + motion * 6, 176, 11, GREEN);
    drawCircle(png, 176 - motion * 6, 172, 12, RED);
  } else if (scene === 'knead') {
    fillRect(png, 60, 208, 200, 12, BOARD);
    drawCircle(png, 160, 178, 44, [244, 214, 164, 255]);
    fillRect(png, 78 + motion * 10, 136, 32, 22, RED);
    fillRect(png, 210 - motion * 10, 136, 32, 22, RED);
    drawLine(png, 95 + motion * 10, 158, 126, 182, INK, 3);
    drawLine(png, 226 - motion * 10, 158, 194, 182, INK, 3);
  } else {
    drawCircle(png, 160, 176, 74, [244, 240, 232, 255]);
    drawCircle(png, 160, 176, 62, WHITE);
    drawCircle(png, 136 + motion * 4, 168, 14, GREEN);
    drawCircle(png, 180, 166 + motion * 3, 12, RED);
    drawCircle(png, 164 - motion * 3, 194, 16, GOLD);
    drawLine(png, 98, 122, 222, 230, GRAY, 4);
    drawLine(png, 222, 122, 98, 230, GRAY, 4);
  }
}

function renderFallbackStill(stepText: string): Buffer {
  const png = createCanvas();
  renderScene(png, inferScene(stepText), 1);
  return PNG.sync.write(png);
}

function renderFallbackMotion(stepText: string): IllustrationResult {
  const scene = inferScene(stepText);
  const frames: DecodedPngFrame[] = [];

  for (let i = 0; i < FRAME_COUNT; i++) {
    const png = createCanvas();
    renderScene(png, scene, i);
    const buffer = PNG.sync.write(png);
    const decoded = decodePng(buffer);
    if (decoded) {
      frames.push(decoded);
    }
  }

  const gifBuffer = frames.length >= 2 ? stitchGif(frames) : null;
  if (gifBuffer) {
    return { data: gifBuffer.toString('base64'), format: 'gif' };
  }

  return { data: renderFallbackStill(stepText).toString('base64'), format: 'png' };
}

export async function generateStepIllustration(stepText: string): Promise<IllustrationResult | null> {
  console.log('[IllustrationService] Generating for step:', stepText);
  const motion = isMotionStep(stepText);
  let result: IllustrationResult | null = null;

  if (motion) {
    console.log('[IllustrationService] Motion step detected, generating', FRAME_COUNT, 'frames');
    const sceneContext = `"${stepText}". Detailed 3D cartoon style with rounded tactile forms, soft volumetric lighting, gentle shadows, isometric camera angle. Warm earthy palette (rich browns, vibrant greens, soft creams, terracotta, gold). Clearly show the technique so a beginner can follow. No text or labels.`;
    const prompts = [
      `Frame 1 of ${FRAME_COUNT}: The very beginning — ${sceneContext} Show all ingredients and tools positioned on the surface, ready for the action to start. Ingredients should be clearly identifiable with accurate proportions. This establishes the exact scene composition, lighting, and camera angle that must stay identical across all frames.`,
      `Frame 2 of ${FRAME_COUNT}: Midway through the action — ${sceneContext} The cooking technique is actively in progress, showing the motion clearly. Maintain the identical background, lighting, surface, and camera angle from frame 1. Only the hands, tool, or ingredient being acted upon changes position.`,
      `Frame 3 of ${FRAME_COUNT}: Nearly complete — ${sceneContext} The result of the technique is clearly visible and taking shape. Maintain the identical background, lighting, surface, and camera angle from previous frames. Only the action element shows the final transformed state.`,
    ];

    const frames = await Promise.all(prompts.map((prompt) => generateSingleImage(prompt)));
    const decodedFrames = frames
      .filter((frame): frame is StillImageResult => frame !== null && frame.format === 'png')
      .map((frame) => decodePng(frame.buffer))
      .filter((frame): frame is DecodedPngFrame => frame !== null);

    if (decodedFrames.length >= 2) {
      const gifBuffer = stitchGif(decodedFrames);
      if (gifBuffer) {
        result = { data: gifBuffer.toString('base64'), format: 'gif' };
      }
    }

    if (!result) {
      result = renderFallbackMotion(stepText);
    }
  } else {
    console.log('[IllustrationService] Static step detected, generating single image');
    const stillImage = await generateSingleImage(stepText);
    if (stillImage) {
      result = { data: stillImage.buffer.toString('base64'), format: stillImage.format };
    } else {
      result = { data: renderFallbackStill(stepText).toString('base64'), format: 'png' };
    }
  }

  console.log('[IllustrationService] Generated:', result.format, '~' + Math.round(result.data.length / 1024) + 'KB');
  return result;
}

export async function generateClarifyIllustration(description: string): Promise<IllustrationResult | null> {
  console.log('[IllustrationService] Generating clarify illustration:', description);
  const stillImage = await generateSingleImage(description);
  if (stillImage) {
    return { data: stillImage.buffer.toString('base64'), format: stillImage.format };
  }
  return { data: renderFallbackStill(description).toString('base64'), format: 'png' };
}

export const __testing = {
  setImageGeneratorOverride(generator: ImageGenerator | null): void {
    imageGeneratorOverride = generator;
  },
  setRemoteImageGenerationDisabled(value: boolean): void {
    remoteImageGenerationDisabled = value;
  },
  extractGeneratedImage,
  renderFallbackStill,
  renderFallbackMotion,
};
