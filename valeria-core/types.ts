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