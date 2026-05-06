import {
  getLlama,
  LlamaChatSession,
  type Llama,
  type LlamaModel,
  type LlamaContext,
} from 'node-llama-cpp';
import { LLMEngine, LLMConfig, Message, VALERIA_SYSTEM_PROMPT } from '@valeria/core';

export class LLMService implements LLMEngine {
  private llama: Llama | null = null;
  private model: LlamaModel | null = null;
  private context: LlamaContext | null = null;
  private session: LlamaChatSession | null = null;
  private config: LLMConfig | null = null;

  async initialize(config: LLMConfig): Promise<void> {
    this.config = config;
    console.log(`Loading LLM from: ${config.modelPath}`);
    const startTime = Date.now();

    this.llama = await getLlama();

    this.model = await this.llama.loadModel({
      modelPath: config.modelPath,
      ...(config.gpuLayers > 0 && { gpuLayers: config.gpuLayers }),
    });

    this.context = await this.model.createContext({
      contextSize: config.contextSize,
    });

    this.session = new LlamaChatSession({
      contextSequence: this.context.getSequence(),
      systemPrompt: VALERIA_SYSTEM_PROMPT.content,
    });

    console.log(`LLM ready in ${Date.now() - startTime}ms`);
  }

  async *generateStream(messages: Message[]): AsyncGenerator<string, void, unknown> {
    if (!this.session || !this.config) {
      throw new Error('LLM not initialized. Call initialize() first.');
    }

    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;

    console.log(`Generating response to: "${lastUser.content}"`);
    const startTime = Date.now();
    let tokenCount = 0;

    const tokenQueue: string[] = [];
    let resolveWaiting: (() => void) | null = null;
    let isDone = false;

    const { maxTokens, temperature } = this.config;

    const generationPromise = this.session.prompt(lastUser.content, {
      maxTokens,
      temperature,
      onTextChunk: (text: string) => {
        tokenQueue.push(text);
        tokenCount++;
        if (resolveWaiting) {
          resolveWaiting();
          resolveWaiting = null;
        }
      },
    }).then(() => {
      isDone = true;
      if (resolveWaiting) {
        resolveWaiting();
        resolveWaiting = null;
      }
    });

    while (true) {
      while (tokenQueue.length > 0) {
        yield tokenQueue.shift()!;
      }
      if (isDone && tokenQueue.length === 0) break;
      await new Promise<void>((resolve) => {
        resolveWaiting = resolve;
      });
    }

    await generationPromise;

    const elapsed = Date.now() - startTime;
    console.log(`Generated ${tokenCount} tokens in ${elapsed}ms (${(tokenCount / (elapsed / 1000)).toFixed(1)} tok/s)`);
  }

  dispose(): void {
    if (this.context) {
      this.context.dispose();
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
