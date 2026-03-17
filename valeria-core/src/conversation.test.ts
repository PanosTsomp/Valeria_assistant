import { describe, it, expect, beforeEach } from 'vitest';
import { Conversation, VALERIA_SYSTEM_PROMPT } from './conversation.js';
import { Message } from './types.js';

/**
 * ABOUT THESE TESTS:
 * 
 * Each test follows the "Arrange → Act → Assert" pattern:
 * - Arrange: set up the objects you need
 * - Act: call the method you're testing  
 * - Assert: check that the result matches your expectation
 * 
 * The describe() blocks group related tests together.
 * The it() blocks describe individual behaviors.
 * Good test names read like sentences: "it starts with an empty history"
 */

describe('Conversation', () => {
  let conversation: Conversation;

  // beforeEach runs before EVERY test, giving each test a fresh instance.
  // This prevents tests from affecting each other — a critical testing principle
  // called "test isolation."
  beforeEach(() => {
    conversation = new Conversation();
  });

  describe('initialization', () => {
    it('starts with an empty history', () => {
      expect(conversation.getHistory()).toEqual([]);
      expect(conversation.getLength()).toBe(0);
    });

    it('includes the system prompt in messages', () => {
      const messages = conversation.getMessages();

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toContain('Valeria');
    });

    it('accepts a custom system prompt', () => {
      const custom: Message = {
        role: 'system',
        content: 'You are a test bot.',
      };
      const conv = new Conversation(custom);

      expect(conv.getMessages()[0].content).toBe('You are a test bot.');
    });
  });

  describe('addMessage', () => {
    it('appends a user message', () => {
      conversation.addMessage('user', 'Hello Valeria');

      const history = conversation.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({
        role: 'user',
        content: 'Hello Valeria',
      });
    });

    it('appends an assistant message', () => {
      conversation.addMessage('assistant', 'Hello! How can I help?');

      const history = conversation.getHistory();
      expect(history[0].role).toBe('assistant');
    });

    it('maintains message order', () => {
      conversation.addMessage('user', 'First');
      conversation.addMessage('assistant', 'Second');
      conversation.addMessage('user', 'Third');

      const history = conversation.getHistory();
      expect(history.map((m) => m.content)).toEqual([
        'First',
        'Second',
        'Third',
      ]);
    });

    it('trims whitespace from message content', () => {
      conversation.addMessage('user', '  Hello Valeria  ');

      expect(conversation.getHistory()[0].content).toBe('Hello Valeria');
    });

    it('ignores empty messages', () => {
      conversation.addMessage('user', '');
      conversation.addMessage('user', '   ');

      expect(conversation.getLength()).toBe(0);
    });
  });

  describe('getMessages', () => {
    it('always starts with the system prompt', () => {
      conversation.addMessage('user', 'Hello');
      conversation.addMessage('assistant', 'Hi there!');

      const messages = conversation.getMessages();
      expect(messages[0].role).toBe('system');
      expect(messages[0]).toEqual(VALERIA_SYSTEM_PROMPT);
    });

    it('includes history after system prompt', () => {
      conversation.addMessage('user', 'Hello');
      conversation.addMessage('assistant', 'Hi!');

      const messages = conversation.getMessages();
      expect(messages).toHaveLength(3); // system + user + assistant
      expect(messages[1].content).toBe('Hello');
      expect(messages[2].content).toBe('Hi!');
    });

    it('returns a copy, not a reference to internal state', () => {
      const messages1 = conversation.getMessages();
      messages1.push({ role: 'user', content: 'injected!' });

      // The injected message should NOT appear in the real messages
      const messages2 = conversation.getMessages();
      expect(messages2).toHaveLength(1); // Still just the system prompt
    });
  });

  describe('clear', () => {
    it('removes all history', () => {
      conversation.addMessage('user', 'Hello');
      conversation.addMessage('assistant', 'Hi!');
      conversation.clear();

      expect(conversation.getLength()).toBe(0);
      expect(conversation.getHistory()).toEqual([]);
    });

    it('preserves the system prompt after clearing', () => {
      conversation.addMessage('user', 'Hello');
      conversation.clear();

      const messages = conversation.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('system');
    });
  });

  describe('getLastMessage', () => {
    it('returns undefined for empty conversation', () => {
      expect(conversation.getLastMessage()).toBeUndefined();
    });

    it('returns the most recent message', () => {
      conversation.addMessage('user', 'Hello');
      conversation.addMessage('assistant', 'Hi!');

      expect(conversation.getLastMessage()?.content).toBe('Hi!');
    });
  });

  describe('trimHistory', () => {
    /**
     * For these tests, we use a custom system prompt with known length
     * so we can calculate exact token budgets.
     * 
     * "Test system" = 11 characters ≈ 3 tokens (11 / 4, rounded up)
     */
    let conv: Conversation;

    beforeEach(() => {
      conv = new Conversation({
        role: 'system',
        content: 'Test system',
      });
    });

    it('does nothing when history fits within budget', () => {
      conv.addMessage('user', 'Hi');       // ~1 token
      conv.addMessage('assistant', 'Hey'); // ~1 token
      // Total: 3 (system) + 1 + 1 = 5 tokens

      conv.trimHistory(100); // Generous budget

      expect(conv.getLength()).toBe(2);
    });

    it('removes oldest messages when over budget', () => {
      // Each message ≈ 5 tokens (20 chars / 4)
      conv.addMessage('user', 'First message here!!' );     // ~5 tokens
      conv.addMessage('assistant', 'First reply here!!' );  // ~5 tokens  
      conv.addMessage('user', 'Second message here!' );     // ~5 tokens
      conv.addMessage('assistant', 'Second reply here!' );  // ~5 tokens
      // System: ~3 tokens. Total: ~23 tokens

      conv.trimHistory(15); // Budget for system + ~2 messages

      // Should keep only the most recent messages
      const history = conv.getHistory();
      expect(history.length).toBeLessThan(4);

      // Most recent messages should be preserved
      const lastMsg = conv.getLastMessage();
      expect(lastMsg?.content).toBe('Second reply here!');
    });

    it('always preserves the system prompt', () => {
      conv.addMessage('user', 'Hello');
      conv.addMessage('assistant', 'Hi!');

      conv.trimHistory(5); // Very tight budget

      const messages = conv.getMessages();
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toBe('Test system');
    });

    it('clears everything if system prompt alone exceeds budget', () => {
      conv.addMessage('user', 'Hello');

      conv.trimHistory(1); // Impossibly small budget

      expect(conv.getLength()).toBe(0);
    });

    it('keeps recent messages over old messages', () => {
      conv.addMessage('user', 'Old question');
      conv.addMessage('assistant', 'Old answer');
      conv.addMessage('user', 'New question');
      conv.addMessage('assistant', 'New answer');

      // Tight budget: system (~3) + ~2 short messages
      conv.trimHistory(10);

      const history = conv.getHistory();
      const contents = history.map((m) => m.content);

      // "New" messages should survive, "Old" messages should be dropped
      expect(contents).toContain('New answer');
      expect(contents).not.toContain('Old question');
    });
  });
});