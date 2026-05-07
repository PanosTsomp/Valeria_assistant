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

/**
 * TTSService implements the TTSEngine interface from valeria-core
 * using Kokoro TTS (kokoro-js) as the backend.
 * 
 * ABOUT KOKORO:
 * - 82M parameter model, Apache 2.0 licensed
 * - Runs via ONNX Runtime (CPU or WebGPU)
 * - 54 voice options across 8 languages
 * - Produces 24kHz audio
 * - Model auto-downloads on first use (~330 MB for q8)
 * 
 * WHY DYNAMIC IMPORT:
 * kokoro-js is an ESM-only package. Depending on your Electron build
 * config, the main process might compile to CJS. Dynamic import()
 * works in both cases and avoids bundling issues.
 */
export class TTSService implements TTSEngine {
  private tts: KokoroTTSInstance | null = null;
  private voice: string = 'af_sky';

  /**
   * Initialize the Kokoro TTS model.
   * 
   * @param modelPath - For Kokoro, this is the HuggingFace model ID
   *   (e.g., "onnx-community/Kokoro-82M-v1.0-ONNX") or a local path.
   *   We default to the HuggingFace model which auto-downloads.
   * 
   * First run downloads ~330 MB. Subsequent runs use the cache.
   * The cache lives in ~/.cache/huggingface/ on Linux.
   */
  async initialize(modelPath?: string): Promise<void> {
    console.log('Loading Kokoro TTS model...');
    const startTime = Date.now();

    // Dynamic import for ESM compatibility
    const { KokoroTTS } = await import('kokoro-js');

    const modelId = modelPath || 'onnx-community/Kokoro-82M-v1.0-ONNX';

    this.tts = await KokoroTTS.from_pretrained(modelId, {
      dtype: 'q8',       // Quantized for speed — options: fp32, fp16, q8, q4, q4f16
      device: 'cpu',     // 'cpu' for Node.js, 'wasm' or 'webgpu' for browser
    }) as unknown as KokoroTTSInstance;

    const elapsed = Date.now() - startTime;

    // Log available voices
    if (this.tts.list_voices) {
      const voices = this.tts.list_voices();
      console.log(`Kokoro loaded in ${elapsed}ms — ${voices.length} voices available`);
      console.log('Sample voices:', voices.slice(0, 8).join(', '));
    } else {
      console.log(`Kokoro loaded in ${elapsed}ms`);
    }
  }

  /**
   * Set the voice to use for synthesis.
   * 
   * Kokoro voice naming convention:
   * - First letter: language (a = American English, b = British English)
   * - Second letter: gender (f = female, m = male)
   * - Rest: name (e.g., af_sky = American female "Sky")
   * 
   * Some good options for Valeria:
   * - af_sky — warm, natural American female
   * - af_nicole — clear, professional American female
   * - bf_emma — British female
   */
  setVoice(voice: string): void {
    this.voice = voice;
    console.log(`TTS voice set to: ${voice}`);
  }

  /**
   * Synthesize text into audio.
   * 
   * Returns a Float32Array of audio samples at 24kHz.
   * The renderer will play this through the Web Audio API.
   */
  async synthesize(text: string): Promise<Float32Array> {
    if (!this.tts) {
      throw new Error('TTS not initialized. Call initialize() first.');
    }

    if (text.trim() === '') {
      return new Float32Array(0);
    }

    console.log(`Synthesizing: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);
    const startTime = Date.now();

    const result = await this.tts.generate(text, {
      voice: this.voice,
    });

    const elapsed = Date.now() - startTime;
    const duration = (result.audio.length / result.sampling_rate).toFixed(1);
    console.log(`TTS: ${elapsed}ms → ${duration}s of audio at ${result.sampling_rate}Hz`);

    return result.audio;
  }

  /**
   * Get the sample rate of the output audio.
   * Kokoro outputs at 24kHz. The renderer needs to know this
   * to create the correct AudioContext for playback.
   */
  getSampleRate(): number {
    return 24000;
  }

  /**
   * Release model resources.
   */
  dispose(): void {
    this.tts = null;
    console.log('TTS resources released');
  }
}