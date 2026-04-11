// src/main/whisper-service.ts

import { initWhisper } from '@fugood/whisper.node';

/**
 * WhisperService wraps @fugood/whisper.node for use in Electron's main process.
 * 
 * WHY A SEPARATE SERVICE FILE:
 * The main/index.ts is getting large. Extracting the Whisper logic into its
 * own file keeps things organized and makes it easier to swap implementations
 * later. This follows the same pattern as the STTEngine interface from
 * packages/core — even though we're not formally implementing the interface
 * here (that happens in milestone 9), the shape is the same.
 * 
 * ABOUT @fugood/whisper.node:
 * This package provides Node.js bindings for whisper.cpp. It:
 * - Ships pre-built native binaries (no C++ compilation needed)
 * - Supports GPU acceleration (CUDA on Linux, Metal on macOS)
 * - Provides the same API as whisper.rn (React Native) by design
 * - Accepts both file paths and raw audio data for transcription
 */

// The WhisperContext type from the library
type WhisperContext = Awaited<ReturnType<typeof initWhisper>>;

export class WhisperService {
  private context: WhisperContext | null = null;
  private modelPath: string;

  constructor(modelPath: string) {
    this.modelPath = modelPath;
  }

  /**
   * Load the Whisper model into memory.
   * 
   * This is the slow part — loading a 142 MB model takes 1-3 seconds.
   * Call this once at app startup, not on every transcription.
   * 
   * useGpu: true enables CUDA acceleration on your NVIDIA GPU.
   * The library auto-detects the GPU and falls back to CPU if needed.
   */
  async initialize(): Promise<void> {
    console.log(`Loading Whisper model from: ${this.modelPath}`);
    const startTime = Date.now();

    this.context = await initWhisper({
    filePath: this.modelPath,
    useGpu: true,
    }, 'cuda');

    const elapsed = Date.now() - startTime;
    console.log(`Whisper model loaded in ${elapsed}ms`);
  }

  /**
   * Transcribe audio data.
   * 
   * IMPORTANT: The input format matters.
   * @fugood/whisper.node expects an ArrayBuffer of 16-bit PCM audio
   * at 16kHz mono. But our recording pipeline (milestone 5) produces
   * Float32Array at 16kHz mono. We need to convert Float32 → Int16.
   * 
   * Float32 range: -1.0 to 1.0
   * Int16 range:   -32768 to 32767
   * Conversion:    sample * 32767
   * 
   * @param audioFloat32 - Audio samples from the recorder (Float32Array, 16kHz mono)
   * @returns The transcribed text
   */
  async transcribe(audioFloat32: Float32Array): Promise<string> {
    if (!this.context) {
      throw new Error('Whisper not initialized. Call initialize() first.');
    }

    // Convert Float32Array to Int16 ArrayBuffer
    const int16 = new Int16Array(audioFloat32.length);
    for (let i = 0; i < audioFloat32.length; i++) {
      // Clamp to [-1, 1] range then scale to Int16
      const clamped = Math.max(-1, Math.min(1, audioFloat32[i]));
      int16[i] = Math.round(clamped * 32767);
    }

    console.log(`Transcribing ${audioFloat32.length} samples (${(audioFloat32.length / 16000).toFixed(1)}s of audio)...`);
    const startTime = Date.now();

    // transcribeData returns { stop, promise }
    // stop() can cancel a running transcription
    // promise resolves with the result
    const { promise } = this.context.transcribeData(int16.buffer, {
      language: 'en',
      temperature: 0.0,      // 0 = most deterministic/accurate
      maxLen: 0,              // 0 = no limit on segment length
      tokenTimestamps: false, // We don't need word-level timestamps
    });

    const result = await promise;

    const elapsed = Date.now() - startTime;
    console.log(`Transcription completed in ${elapsed}ms`);

    // The result contains segments with start/end times and text
    // We combine all segments into a single string
    if (result && result.segments && result.segments.length > 0) {
      const text = result.segments
        .map((segment: { text: string }) => segment.text.trim())
        .join(' ')
        .trim();
      return text;
    }

    return '';
  }

  /**
   * Release the model from memory.
   */
  async dispose(): Promise<void> {
    if (this.context) {
      await this.context.release();
      this.context = null;
      console.log('Whisper model released');
    }
  }
}