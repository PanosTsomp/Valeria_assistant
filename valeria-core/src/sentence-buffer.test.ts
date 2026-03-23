// src/sentence-buffer.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SentenceBuffer } from './sentence-buffer.js';

/**
 * NEW CONCEPT: vi.fn()
 * 
 * vi.fn() creates a "mock function" — a fake function that records
 * every time it gets called and what arguments it received.
 * 
 * This is perfect for testing callbacks. We give the SentenceBuffer
 * a mock function as its onSentence callback, then after pushing
 * tokens, we can check:
 * - Was the callback called? (expect(mock).toHaveBeenCalled())
 * - How many times? (expect(mock).toHaveBeenCalledTimes(2))
 * - With what arguments? (expect(mock).toHaveBeenCalledWith("Hello."))
 * - In what order? (mock.mock.calls[0][0] for first call's first argument)
 */

describe('SentenceBuffer', () => {
  let onSentence: ReturnType<typeof vi.fn<(sentence: string) => void>>;
  let buffer: SentenceBuffer;

  beforeEach(() => {
    onSentence = vi.fn<(sentence: string) => void>();
    buffer = new SentenceBuffer(onSentence);
  });

  describe('basic sentence detection', () => {
    it('does not emit until a sentence boundary is found', () => {
      buffer.push('Hello');
      buffer.push(' world');

      expect(onSentence).not.toHaveBeenCalled();
    });

    it('emits a sentence ending with a period followed by space', () => {
      buffer.push('Hello world. ');

      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith('Hello world.');
    });

    it('emits a sentence ending with a question mark followed by space', () => {
      buffer.push('How are you? ');

      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith('How are you?');
    });

    it('emits a sentence ending with an exclamation mark followed by space', () => {
      buffer.push('Wow! ');

      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith('Wow!');
    });

    it('emits multiple sentences from a single push', () => {
      buffer.push('First sentence. Second sentence. ');

      expect(onSentence).toHaveBeenCalledTimes(2);
      expect(onSentence).toHaveBeenNthCalledWith(1, 'First sentence.');
      expect(onSentence).toHaveBeenNthCalledWith(2, 'Second sentence.');
    });
  });

  describe('streaming token simulation', () => {
    it('accumulates tokens and emits when sentence completes', () => {
      buffer.push('Hel');
      buffer.push('lo');
      buffer.push(' wor');
      buffer.push('ld.');
      buffer.push(' Next');

      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith('Hello world.');
    });

    it('handles tokens that split across the sentence boundary', () => {
      // The period and the next word arrive in the same token
      buffer.push('End. Start');

      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith('End.');
    });

    it('handles multiple sentences arriving token by token', () => {
      const tokens = ['I', ' am', ' here', '.', ' Are', ' you', '?', ' Yes', '!', ' '];

      for (const token of tokens) {
        buffer.push(token);
      }

      expect(onSentence).toHaveBeenCalledTimes(3);
      expect(onSentence).toHaveBeenNthCalledWith(1, 'I am here.');
      expect(onSentence).toHaveBeenNthCalledWith(2, 'Are you?');
      expect(onSentence).toHaveBeenNthCalledWith(3, 'Yes!');
    });
  });

  describe('abbreviation handling', () => {
    it('does not split on Dr.', () => {
      buffer.push('Dr. Smith is here. ');

      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith('Dr. Smith is here.');
    });

    it('does not split on Mr. or Mrs.', () => {
      buffer.push('Mr. and Mrs. Jones arrived. ');

      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith('Mr. and Mrs. Jones arrived.');
    });

    it('does not split on U.S.', () => {
      buffer.push('The U.S. is large. ');

      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith('The U.S. is large.');
    });

    it('does not split on etc.', () => {
      buffer.push('Apples, oranges, etc. are fruits. ');

      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith('Apples, oranges, etc. are fruits.');
    });
  });

  describe('number handling', () => {
    it('does not split on decimal numbers', () => {
      buffer.push('Pi is 3.14 approximately. ');

      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith('Pi is 3.14 approximately.');
    });

    it('does not split on currency', () => {
      buffer.push('It costs $99.99 total. ');

      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith('It costs $99.99 total.');
    });
  });

  describe('flush', () => {
    it('emits remaining text without a sentence boundary', () => {
      buffer.push('This has no ending');
      buffer.flush();

      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith('This has no ending');
    });

    it('does nothing when buffer is empty', () => {
      buffer.flush();

      expect(onSentence).not.toHaveBeenCalled();
    });

    it('does nothing when buffer is only whitespace', () => {
      buffer.push('   ');
      buffer.flush();

      expect(onSentence).not.toHaveBeenCalled();
    });

    it('emits remaining text after previous sentences were emitted', () => {
      buffer.push('First. Second part');
      // "First." won't emit yet because "Second" follows without
      // the period being followed by space at the time of the period push.
      // But actually "First. Second" — the period IS followed by a space.
      // So "First." emits, and "Second part" remains in the buffer.

      buffer.flush();

      // "First." was emitted during push, "Second part" during flush
      expect(onSentence).toHaveBeenCalledTimes(2);
      expect(onSentence).toHaveBeenNthCalledWith(1, 'First.');
      expect(onSentence).toHaveBeenNthCalledWith(2, 'Second part');
    });

    it('clears the buffer after flushing', () => {
      buffer.push('Some text');
      buffer.flush();
      buffer.flush(); // Second flush should do nothing

      expect(onSentence).toHaveBeenCalledTimes(1);
    });
  });

  describe('reset', () => {
    it('clears the buffer without emitting', () => {
      buffer.push('Partial sentence');
      buffer.reset();

      expect(onSentence).not.toHaveBeenCalled();
    });

    it('allows fresh input after reset', () => {
      buffer.push('Old text');
      buffer.reset();
      buffer.push('New sentence. ');

      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith('New sentence.');
    });
  });

  describe('edge cases', () => {
    it('handles empty string tokens', () => {
      buffer.push('');
      buffer.push('Hello.');
      buffer.push('');
      buffer.push(' Next');

      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith('Hello.');
    });

    it('handles sentence with only punctuation and space', () => {
      buffer.push('No. ');

      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith('No.');
    });

    it('handles multiple punctuation marks', () => {
      buffer.push('What?! ');

      // "?!" — the ? followed by ! and then space
      // The regex should catch "?" followed by "! " or "?!" followed by " "
      // This depends on implementation, but we should get at least one emission
      expect(onSentence).toHaveBeenCalled();
    });

    it('handles newlines as whitespace after punctuation', () => {
      buffer.push('End.\nStart');

      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith('End.');
    });
  });

  describe('realistic LLM simulation', () => {
    it('handles a full Valeria-style response', () => {
      // Simulate how an LLM actually streams tokens
      const tokens = [
        "I", " don't", " have", " access", " to",
        " real", "-time", " weather", " data", ".",
        " However", ",", " I", " can", " help",
        " you", " find", " that", " information",
        " if", " you", " check", " a", " weather",
        " app", "."
      ];

      for (const token of tokens) {
        buffer.push(token);
      }

      buffer.flush();

      expect(onSentence).toHaveBeenCalledTimes(2);
      expect(onSentence).toHaveBeenNthCalledWith(
        1,
        "I don't have access to real-time weather data."
      );
      expect(onSentence).toHaveBeenNthCalledWith(
        2,
        "However, I can help you find that information if you check a weather app."
      );
    });
  });
});