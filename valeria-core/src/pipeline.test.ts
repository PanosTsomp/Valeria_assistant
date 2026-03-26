import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pipeline, PipelineState, PipelineCallbacks } from './pipeline.js';
import { Conversation } from './conversation.js';
import { STTEngine, LLMEngine, TTSEngine, Message } from './types.js';

// ============================================================
// MOCK ENGINES
// ============================================================

/**
 * A fake STT engine that returns a preset transcript.
 * 
 * WHY WE BUILD THIS:
 * We don't have whisper.cpp installed. We don't have a microphone.
 * We don't even have audio. But we need to test that the pipeline
 * correctly passes audio to STT and uses the result. By controlling
 * exactly what the mock returns, we can test the pipeline's behavior
 * without any real AI.
 * 
 * This is dependency injection in action: the pipeline doesn't know
 * (or care) that it's talking to a fake. It calls transcribe(),
 * gets a string back, and proceeds.
 */
function createMockSTT(transcript: string = 'Hello Valeria'): STTEngine {
  return {
    initialize: vi.fn<(modelPath: string) => Promise<void>>().mockResolvedValue(undefined),
    transcribe: vi.fn<(audio: Float32Array) => Promise<string>>().mockResolvedValue(transcript),
    dispose: vi.fn(),
  };
}

/**
 * A fake LLM engine that yields preset tokens.
 * 
 * This is the most interesting mock because it simulates STREAMING.
 * The async generator yields tokens one at a time, just like a real
 * LLM would. The pipeline's for-await-of loop consumes them identically
 * to how it would consume real llama.cpp tokens.
 * 
 * @param tokens - Array of tokens to yield, e.g. ["I", " am", " Valeria", "."]
 */
function createMockLLM(
  tokens: string[] = ['I', ' am', ' Valeria', '.']
): LLMEngine {
  return {
    initialize: vi.fn<(config: any) => Promise<void>>().mockResolvedValue(undefined),
    generateStream: vi.fn<(messages: Message[]) => AsyncGenerator<string, void, unknown>>()
      .mockImplementation(async function* () {
        for (const token of tokens) {
          yield token;
        }
      }),
    dispose: vi.fn(),
  };
}

/**
 * A fake TTS engine that returns an empty audio buffer.
 * 
 * In real usage, this would return a Float32Array of audio samples.
 * For testing, we return a tiny buffer — the pipeline just needs to
 * see that synthesize() was called with the right sentences.
 */
function createMockTTS(): TTSEngine {
  return {
    initialize: vi.fn<(modelPath: string) => Promise<void>>().mockResolvedValue(undefined),
    synthesize: vi.fn<(text: string) => Promise<Float32Array>>()
      .mockResolvedValue(new Float32Array([0.0, 0.1, 0.2])),
    dispose: vi.fn(),
  };
}

/**
 * Create a full set of mock callbacks using vi.fn().
 * Every callback is a spy that records its calls.
 */
function createMockCallbacks(): PipelineCallbacks {
  return {
    onStateChange: vi.fn<(state: PipelineState) => void>(),
    onTranscript: vi.fn<(text: string) => void>(),
    onToken: vi.fn<(token: string) => void>(),
    onSentence: vi.fn<(sentence: string) => void>(),
    onAudio: vi.fn<(audio: Float32Array) => void>(),
    onComplete: vi.fn<(fullResponse: string) => void>(),
    onError: vi.fn<(error: Error) => void>(),
  };
}

// ============================================================
// TESTS
// ============================================================

describe('Pipeline', () => {
  let stt: STTEngine;
  let llm: LLMEngine;
  let tts: TTSEngine;
  let conversation: Conversation;
  let callbacks: PipelineCallbacks;
  let pipeline: Pipeline;

  beforeEach(() => {
    stt = createMockSTT('What is the weather today');
    llm = createMockLLM([
      'I', ' don\'t', ' have', ' weather', ' data', '.',
      ' Try', ' a', ' weather', ' app', '.',
    ]);
    tts = createMockTTS();
    conversation = new Conversation({
      role: 'system',
      content: 'You are Valeria.',
    });
    callbacks = createMockCallbacks();
    pipeline = new Pipeline(stt, llm, tts, conversation, callbacks);
  });

  describe('state management', () => {
    it('starts in idle state', () => {
      expect(pipeline.getState()).toBe('idle');
    });

    it('transitions through all states during processing', async () => {
      await pipeline.processVoiceInput(new Float32Array([0.1, 0.2]));

      const stateChanges = (callbacks.onStateChange as ReturnType<typeof vi.fn>)
        .mock.calls.map((call) => call[0]);

      // Should go: listening → thinking → speaking → idle
      expect(stateChanges).toContain('listening');
      expect(stateChanges).toContain('thinking');
      expect(stateChanges).toContain('speaking');
      expect(stateChanges[stateChanges.length - 1]).toBe('idle');
    });

    it('returns to idle after processing completes', async () => {
      await pipeline.processVoiceInput(new Float32Array([0.1, 0.2]));

      expect(pipeline.getState()).toBe('idle');
    });

    it('rejects concurrent processing', async () => {
      // Start a long-running process by using a slow mock
      const slowSTT = createMockSTT('Hello');
      slowSTT.transcribe = vi.fn<(audio: Float32Array) => Promise<string>>()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve('Hello'), 100))
        );

      const slowPipeline = new Pipeline(
        slowSTT, llm, tts, conversation, callbacks
      );

      // Start first process (don't await — let it run)
      const first = slowPipeline.processVoiceInput(new Float32Array([0.1]));

      // Try to start second process immediately
      await slowPipeline.processVoiceInput(new Float32Array([0.2]));

      // Second call should have triggered an error
      expect(callbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Cannot process input'),
        })
      );

      // Wait for first to finish
      await first;
    });
  });

  describe('STT stage', () => {
    it('passes audio to the STT engine', async () => {
      const audio = new Float32Array([0.1, 0.2, 0.3]);
      await pipeline.processVoiceInput(audio);

      expect(stt.transcribe).toHaveBeenCalledWith(audio);
    });

    it('emits the transcript via callback', async () => {
      await pipeline.processVoiceInput(new Float32Array([0.1]));

      expect(callbacks.onTranscript).toHaveBeenCalledWith(
        'What is the weather today'
      );
    });

    it('adds user message to conversation history', async () => {
      await pipeline.processVoiceInput(new Float32Array([0.1]));

      const history = conversation.getHistory();
      expect(history[0]).toEqual({
        role: 'user',
        content: 'What is the weather today',
      });
    });

    it('returns to idle on empty transcript', async () => {
      const silentSTT = createMockSTT('');
      const silentPipeline = new Pipeline(
        silentSTT, llm, tts, conversation, callbacks
      );

      await silentPipeline.processVoiceInput(new Float32Array([0.0]));

      expect(pipeline.getState()).toBe('idle');
      expect(callbacks.onTranscript).not.toHaveBeenCalled();
      // LLM should never have been called
      expect(llm.generateStream).not.toHaveBeenCalled();
    });
  });

  describe('LLM stage', () => {
    it('passes conversation history to the LLM', async () => {
      await pipeline.processVoiceInput(new Float32Array([0.1]));

      expect(llm.generateStream).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({
            role: 'user',
            content: 'What is the weather today',
          }),
        ])
      );
    });

    it('emits each token via callback', async () => {
      await pipeline.processVoiceInput(new Float32Array([0.1]));

      const tokenCalls = (callbacks.onToken as ReturnType<typeof vi.fn>)
        .mock.calls.map((call) => call[0]);

      expect(tokenCalls).toEqual([
        'I', ' don\'t', ' have', ' weather', ' data', '.',
        ' Try', ' a', ' weather', ' app', '.',
      ]);
    });

    it('assembles the full response from tokens', async () => {
      await pipeline.processVoiceInput(new Float32Array([0.1]));

      expect(callbacks.onComplete).toHaveBeenCalledWith(
        'I don\'t have weather data. Try a weather app.'
      );
    });

    it('adds assistant message to conversation history', async () => {
      await pipeline.processVoiceInput(new Float32Array([0.1]));

      const history = conversation.getHistory();
      const lastMessage = history[history.length - 1];
      expect(lastMessage.role).toBe('assistant');
      expect(lastMessage.content).toBe(
        'I don\'t have weather data. Try a weather app.'
      );
    });
  });

  describe('sentence buffer + TTS stage', () => {
    it('sends complete sentences to TTS', async () => {
      await pipeline.processVoiceInput(new Float32Array([0.1]));

      // The LLM generates two sentences:
      // "I don't have weather data." and "Try a weather app."
      // The sentence buffer should dispatch each to TTS
      expect(tts.synthesize).toHaveBeenCalled();

      const ttsCalls = (tts.synthesize as ReturnType<typeof vi.fn>)
        .mock.calls.map((call) => call[0]);

      // At least one sentence should have been synthesized
      expect(ttsCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('emits audio via callback when TTS completes', async () => {
      await pipeline.processVoiceInput(new Float32Array([0.1]));

      expect(callbacks.onAudio).toHaveBeenCalled();
    });

    it('emits sentences via callback', async () => {
      await pipeline.processVoiceInput(new Float32Array([0.1]));

      expect(callbacks.onSentence).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('returns to idle when STT fails', async () => {
      const failingSTT = createMockSTT();
      failingSTT.transcribe = vi.fn<(audio: Float32Array) => Promise<string>>()
        .mockRejectedValue(new Error('Microphone error'));

      const failPipeline = new Pipeline(
        failingSTT, llm, tts, conversation, callbacks
      );

      await failPipeline.processVoiceInput(new Float32Array([0.1]));

      expect(failPipeline.getState()).toBe('idle');
      expect(callbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Microphone error' })
      );
    });

    it('returns to idle when LLM fails', async () => {
      const failingLLM = createMockLLM();
      failingLLM.generateStream = vi.fn()
        .mockImplementation(async function* () {
          yield 'partial';
          throw new Error('Model crashed');
        });

      const failPipeline = new Pipeline(
        stt, failingLLM, tts, conversation, callbacks
      );

      await failPipeline.processVoiceInput(new Float32Array([0.1]));

      expect(failPipeline.getState()).toBe('idle');
      expect(callbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Model crashed' })
      );
    });

    it('does not add messages to history when pipeline fails', async () => {
      const failingSTT = createMockSTT();
      failingSTT.transcribe = vi.fn<(audio: Float32Array) => Promise<string>>()
        .mockRejectedValue(new Error('STT failed'));

      const failPipeline = new Pipeline(
        failingSTT, llm, tts, conversation, callbacks
      );

      await failPipeline.processVoiceInput(new Float32Array([0.1]));

      // Conversation should still be empty — nothing was added
      expect(conversation.getLength()).toBe(0);
    });
  });

  describe('conversation continuity', () => {
    it('second exchange includes history from the first', async () => {
      // First exchange
      await pipeline.processVoiceInput(new Float32Array([0.1]));

      // Reconfigure mocks for second exchange
      (stt.transcribe as ReturnType<typeof vi.fn>)
        .mockResolvedValue('Tell me more');

      const secondTokens = [' Sure', ',', ' here', ' you', ' go', '.'];
      (llm.generateStream as ReturnType<typeof vi.fn>)
        .mockImplementation(async function* () {
          for (const t of secondTokens) yield t;
        });

      // Second exchange
      await pipeline.processVoiceInput(new Float32Array([0.1]));

      // LLM should have received the full history on second call
      const secondCall = (llm.generateStream as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as Message[];

      // Should contain: system + user1 + assistant1 + user2
      expect(secondCall).toHaveLength(4);
      expect(secondCall[0].role).toBe('system');
      expect(secondCall[1].role).toBe('user');
      expect(secondCall[2].role).toBe('assistant');
      expect(secondCall[3].role).toBe('user');
      expect(secondCall[3].content).toBe('Tell me more');
    });
  });
});