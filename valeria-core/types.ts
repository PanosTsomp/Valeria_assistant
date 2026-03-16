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