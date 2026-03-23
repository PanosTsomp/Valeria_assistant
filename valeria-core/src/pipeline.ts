import { Message, STTEngine, LLMEngine, TTSEngine } from './types.js';
import { Conversation } from './conversation.js';
import { SentenceBuffer } from './sentence-buffer.js';

/**
 * The four states Valeria can be in.
 * 
 * We use a string union type instead of an enum because:
 * 1. It's simpler — no extra import needed
 * 2. TypeScript can check exhaustiveness just as well
 * 3. The values are readable in logs and debug output
 */
export type PipelineState = 'idle' | 'listening' | 'thinking' | 'speaking';

/**
 * Events the pipeline emits to notify the UI about what's happening.
 * 
 * WHY EVENTS INSTEAD OF RETURN VALUES:
 * The pipeline runs asynchronously across multiple stages. The UI needs
 * to update at each stage transition, display partial transcripts,
 * show streaming tokens, and play audio — all while the pipeline is
 * still running. A single return value can't express all of this.
 * Callbacks let the UI react to each event as it happens.
 */
export interface PipelineCallbacks {
  /** Called whenever the pipeline state changes */
  onStateChange: (state: PipelineState) => void;

  /** Called when STT produces a transcript */
  onTranscript: (text: string) => void;

  /** Called for each token the LLM generates (for displaying in UI) */
  onToken: (token: string) => void;

  /** Called for each complete sentence (for TTS / display) */
  onSentence: (sentence: string) => void;

  /** Called when TTS produces audio for a sentence */
  onAudio: (audio: Float32Array) => void;

  /** Called when the full response is complete */
  onComplete: (fullResponse: string) => void;

  /** Called when any error occurs */
  onError: (error: Error) => void;
}