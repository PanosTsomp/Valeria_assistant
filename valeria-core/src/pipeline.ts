import { STTEngine, LLMEngine, TTSEngine } from './types.js';
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

/**
 * The Pipeline orchestrates Valeria's full voice loop:
 * audio in → STT → LLM (streaming) → sentence buffer → TTS → audio out
 * 
 * DESIGN DECISIONS:
 * 
 * 1. Dependency injection: The pipeline receives its engines through
 *    the constructor instead of creating them internally. This means:
 *    - Tests can pass mock engines
 *    - Desktop passes node-llama-cpp, whisper.node, kokoro-js
 *    - Mobile passes llama.rn, whisper.rn, sherpa-onnx
 *    - The pipeline code is identical in all three cases
 * 
 * 2. Callbacks over return values: The pipeline emits events as they
 *    happen rather than returning a final result. This enables real-time
 *    UI updates during the multi-second processing time.
 * 
 * 3. State machine: Only one operation runs at a time. You can't start
 *    a new voice input while the previous one is still processing.
 *    This prevents resource conflicts (two LLM generations fighting
 *    for the same GPU memory).
 */
export class Pipeline {
  private stt: STTEngine;
  private llm: LLMEngine;
  private tts: TTSEngine;
  private conversation: Conversation;
  private callbacks: PipelineCallbacks;
  private state: PipelineState = 'idle';

  constructor(
    stt: STTEngine,
    llm: LLMEngine,
    tts: TTSEngine,
    conversation: Conversation,
    callbacks: PipelineCallbacks
  ) {
    this.stt = stt;
    this.llm = llm;
    this.tts = tts;
    this.conversation = conversation;
    this.callbacks = callbacks;
  }

  /**
   * Get the current pipeline state.
   */
  getState(): PipelineState {
    return this.state;
  }

  /**
   * Transition to a new state and notify the UI.
   */
  private setState(newState: PipelineState): void {
    this.state = newState;
    this.callbacks.onStateChange(newState);
  }

  /**
   * Process a voice input through the full pipeline.
   * 
   * This is the main method — it runs the entire flow:
   * 1. Transcribe audio (STT)
   * 2. Generate response (LLM, streaming)
   * 3. Buffer into sentences and synthesize (TTS)
   * 
   * @param audio - Raw PCM audio from the microphone (16kHz mono Float32Array)
   * 
   * WHY async:
   * Each stage takes real time (seconds). Using async/await lets us
   * write the stages sequentially (easy to read) while not blocking
   * the main thread (UI stays responsive).
   */
  async processVoiceInput(audio: Float32Array): Promise<void> {
    // Guard: don't allow concurrent processing
    if (this.state !== 'idle') {
      this.callbacks.onError(
        new Error(`Cannot process input: pipeline is ${this.state}`)
      );
      return;
    }

    try {
      // ===== STAGE 1: Speech-to-Text =====
      this.setState('listening');

      const transcript = await this.stt.transcribe(audio);

      // If STT returned empty text (silence, noise), abort gracefully
      if (transcript.trim() === '') {
        this.setState('idle');
        return;
      }

      this.callbacks.onTranscript(transcript);

      // Add the user's message to conversation history
      this.conversation.addMessage('user', transcript);

      // ===== STAGE 2: LLM Generation (streaming) =====
      this.setState('thinking');

      let fullResponse = '';

      // Collect audio chunks from TTS to play in order
      const audioChunks: Float32Array[] = [];

      // Set up the sentence buffer — when a sentence is complete,
      // synthesize it immediately (don't wait for full response)
      const sentenceBuffer = new SentenceBuffer(
        async (sentence: string) => {
          this.callbacks.onSentence(sentence);

          // ===== STAGE 3: Text-to-Speech (per sentence) =====
          // Note: TTS runs concurrently with continued LLM generation
          try {
            const audio = await this.tts.synthesize(sentence);
            audioChunks.push(audio);
            this.callbacks.onAudio(audio);
          } catch (ttsError) {
            // TTS failure for one sentence shouldn't kill the whole pipeline
            // Log it but continue processing remaining sentences
            console.error('TTS failed for sentence:', ttsError);
          }
        }
      );

      // Stream tokens from the LLM
      const messages = this.conversation.getMessages();
      const tokenStream = this.llm.generateStream(messages);

      for await (const token of tokenStream) {
        fullResponse += token;
        this.callbacks.onToken(token);
        sentenceBuffer.push(token);
      }

      // Flush any remaining text that didn't end with punctuation
      sentenceBuffer.flush();

      // ===== STAGE 4: Completion =====
      this.setState('speaking');

      // Add Valeria's response to conversation history
      this.conversation.addMessage('assistant', fullResponse);

      this.callbacks.onComplete(fullResponse);

      this.setState('idle');

    } catch (error) {
      // Any uncaught error in any stage resets to idle
      this.setState('idle');
      this.callbacks.onError(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get the conversation instance for external access.
   * Useful for displaying history in the UI.
   */
  getConversation(): Conversation {
    return this.conversation;
  }
}