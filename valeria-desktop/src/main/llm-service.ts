// src/main/llm-service.ts

import {
  getLlama,
  LlamaChatSession,
  type Llama,
  type LlamaModel,
  type LlamaContext,
} from 'node-llama-cpp';

/**
 * LLMService wraps node-llama-cpp for use in Electron's main process.
 * 
 * node-llama-cpp has a layered architecture:
 * 
 * 1. Llama — The runtime. Handles GPU detection and backend selection.
 *    Created once via getLlama(). Think of it as the "engine."
 * 
 * 2. LlamaModel — A loaded model. Holds the weights in memory.
 *    Created by llama.loadModel(). Think of it as the "brain."
 * 
 * 3. LlamaContext — An inference context with a KV cache.
 *    Created by model.createContext(). Think of it as the "working memory."
 *    The context size (n_ctx) determines how many tokens it can see at once.
 * 
 * 4. LlamaChatSession — A high-level chat interface.
 *    Handles chat templates, conversation history, and streaming.
 *    Created on top of a context.
 */
export class LLMService {
  private llama: Llama | null = null;
  private model: LlamaModel | null = null;
  private context: LlamaContext | null = null;
  private session: LlamaChatSession | null = null;
  private modelPath: string;

  constructor(modelPath: string) {
    this.modelPath = modelPath;
  }

  /**
   * Initialize the full LLM stack.
   * 
   * This loads the model into memory and creates a chat session.
   * Takes 3-10 seconds depending on model size and GPU.
   */
  async initialize(): Promise<void> {
    console.log(`Loading LLM from: ${this.modelPath}`);
    const startTime = Date.now();

    // Step 1: Get the Llama runtime (auto-detects GPU)
    this.llama = await getLlama();
    console.log('Llama runtime ready');

    // Step 2: Load the model
    this.model = await this.llama.loadModel({
      modelPath: this.modelPath,
    });
    console.log('Model loaded');

    // Step 3: Create a context
    // contextSize: how many tokens the model can "see" at once
    // This includes the system prompt, conversation history, AND the response
    // 2048 is conservative but fast. Increase if you need longer conversations.
    this.context = await this.model.createContext({
      contextSize: 2048,
    });
    console.log('Context created');

    // Step 4: Create a chat session with Valeria's personality
    this.session = new LlamaChatSession({
      contextSequence: this.context.getSequence(),
      systemPrompt: [
        'You are Valeria, a friendly and helpful voice assistant.',
        'You run entirely on the user\'s device — no cloud, no internet needed.',
        'Keep your responses concise and conversational since they will be',
        'spoken aloud via text-to-speech. Avoid bullet points, markdown,',
        'or formatting — just natural speech.',
        'If you don\'t know something, say so honestly.',
      ].join(' '),
    });

    const elapsed = Date.now() - startTime;
    console.log(`LLM ready in ${elapsed}ms`);
  }

  /**
   * Generate a streaming response to a user message.
   * 
   * This is an async generator — it yields tokens one at a time
   * as the LLM generates them. The caller consumes with for-await-of.
   * 
   * WHY STREAMING:
   * Generating a full response might take 5-15 seconds. Streaming lets
   * the UI show tokens as they appear (responsive feel) and lets the
   * sentence buffer dispatch sentences to TTS before generation finishes.
   * 
   * @param message - The user's message text
   * @yields Individual tokens as strings
   */
  async *generateStream(message: string): AsyncGenerator<string, void, unknown> {
    if (!this.session) {
      throw new Error('LLM not initialized. Call initialize() first.');
    }

    console.log(`Generating response to: "${message}"`);
    const startTime = Date.now();
    let tokenCount = 0;

    /**
     * LlamaChatSession.prompt() handles:
     * - Adding the user message to chat history
     * - Formatting with the correct chat template for this model
     * - Running inference and generating tokens
     * - Adding the assistant response to chat history
     * 
     * The onTextChunk callback fires for each generated token.
     * We collect tokens in an array and yield them from the generator.
     * 
     * NOTE: We can't yield directly from inside a callback, so we
     * use a queue-based approach: the callback pushes tokens to a
     * queue, and the generator loop pulls from it.
     */
    const tokenQueue: string[] = [];
    let resolveWaiting: (() => void) | null = null;
    let isDone = false;

    // Start generation in the background
    const generationPromise = this.session.prompt(message, {
      maxTokens: 512,
      temperature: 0.7,
      onTextChunk: (text: string) => {
        tokenQueue.push(text);
        tokenCount++;
        // If the generator is waiting for a token, wake it up
        if (resolveWaiting) {
          resolveWaiting();
          resolveWaiting = null;
        }
      },
    }).then(() => {
      isDone = true;
      // Wake up the generator if it's waiting
      if (resolveWaiting) {
        resolveWaiting();
        resolveWaiting = null;
      }
    });

    // Yield tokens as they arrive
    while (true) {
      // If there are tokens in the queue, yield them
      while (tokenQueue.length > 0) {
        yield tokenQueue.shift()!;
      }

      // If generation is done and queue is empty, we're finished
      if (isDone && tokenQueue.length === 0) {
        break;
      }

      // Wait for the next token or completion
      await new Promise<void>((resolve) => {
        resolveWaiting = resolve;
      });
    }

    // Wait for the generation promise to fully resolve
    await generationPromise;

    const elapsed = Date.now() - startTime;
    const tokensPerSec = (tokenCount / (elapsed / 1000)).toFixed(1);
    console.log(`Generated ${tokenCount} tokens in ${elapsed}ms (${tokensPerSec} tok/s)`);
  }

  /**
   * Release all resources.
   */
  async dispose(): Promise<void> {
    if (this.context) {
      await this.context.dispose();
      this.context = null;
    }
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.session = null;
    this.llama = null;
    console.log('LLM resources released');
  }
}