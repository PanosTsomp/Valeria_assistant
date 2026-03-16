/**
 * A single message in a conversation.
 * 
 * Every LLM chat format uses this same basic structure:
 * - "system" messages define the AI's personality and rules
 * - "user" messages are what the human said
 * - "assistant" messages are what the AI responded
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Configuration for the LLM engine.
 */
export interface LLMConfig {
  /** Path to the GGUF model file */
  modelPath: string;
  /** Maximum context window size in tokens (e.g., 2048) */
  contextSize: number;
  /** Number of GPU layers to offload (0 = CPU only) */
  gpuLayers: number;
  /** Temperature controls randomness: 0 = deterministic, 1 = creative */
  temperature: number;
  /** Maximum tokens to generate per response */
  maxTokens: number;
}

/**
 * Speech-to-Text engine interface.
 * 
 * Desktop will implement this with @fugood/whisper.node
 * Mobile will implement this with whisper.rn
 * Tests will implement this with a mock that returns preset text
 */
export interface STTEngine {
  initialize(modelPath: string): Promise<void>;
  transcribe(audio: Float32Array): Promise<string>;
  dispose(): void;
}


/**
 * Speech-to-Text engine interface.
 * 
 * Desktop will implement this with @fugood/whisper.node
 * Mobile will implement this with whisper.rn
 * Tests will implement this with a mock that returns preset text
 */
export interface STTEngine {
  initialize(modelPath: string): Promise<void>;
  transcribe(audio: Float32Array): Promise<string>;
  dispose(): void;
}

/**
 * Large Language Model engine interface.
 * 
 * Desktop will implement this with node-llama-cpp
 * Mobile will implement this with llama.rn
 * Tests will implement this with a mock that yields preset tokens
 * 
 * Note: generateStream returns an AsyncGenerator — a function that
 * yields values one at a time. Each yielded value is a single token
 * (word fragment) from the LLM. This is what enables streaming.
 */
export interface LLMEngine {
  initialize(config: LLMConfig): Promise<void>;
  generateStream(
    messages: Message[]
  ): AsyncGenerator<string, void, unknown>;
  dispose(): void;
}

/**
 * Text-to-Speech engine interface.
 * 
 * Desktop will implement this with kokoro-js
 * Mobile will implement this with sherpa-onnx
 * Tests will implement this with a mock that returns an empty buffer
 */
export interface TTSEngine {
  initialize(modelPath: string): Promise<void>;
  synthesize(text: string): Promise<Float32Array>;
  dispose(): void;
}