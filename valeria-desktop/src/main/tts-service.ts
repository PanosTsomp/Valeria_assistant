// src/main/tts-service.ts

import type { TTSEngine } from '@valeria/core';

// kokoro-js types — we'll import dynamically because it's ESM-only
type KokoroTTSInstance = {
  generate: (text: string, options?: { voice?: string }) => Promise<{
    toWav: () => Uint8Array;
    audio: Float32Array;
    sampling_rate: number;
  }>;
  list_voices: () => string[];
};