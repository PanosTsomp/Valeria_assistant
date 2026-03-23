/**
 * SentenceBuffer accumulates streaming tokens and emits complete sentences.
 * 
 * WHAT IT DOES:
 * Sits between the LLM (which produces tokens one at a time) and the TTS 
 * engine (which needs complete sentences for natural speech). It collects 
 * tokens, detects sentence boundaries, and calls your onSentence callback 
 * with each completed sentence.
 * 
 * WHY A CLASS AND NOT JUST A FUNCTION:
 * The buffer needs to maintain state between token arrivals — the partially
 * built sentence so far. A class keeps this state (this.buffer) encapsulated
 * and private, with a clean public API: push() and flush().
 * 
 * USAGE:
 *   const sb = new SentenceBuffer((sentence) => {
 *     console.log('Complete sentence:', sentence);
 *     ttsEngine.synthesize(sentence);
 *   });
 * 
 *   // As tokens stream from the LLM:
 *   sb.push("I");
 *   sb.push(" don't");
 *   sb.push(" know");
 *   sb.push(".");     // → callback fires with "I don't know."
 *   sb.push(" But");
 *   sb.push(" I");
 *   sb.push(" can");
 *   sb.push(" try");
 *   sb.push("!");     // → callback fires with "But I can try!"
 *   sb.flush();       // → nothing (buffer is empty)
 */
export class SentenceBuffer {
  private buffer: string = '';
  private onSentence: (sentence: string) => void;

  /**
   * @param onSentence — Called with each complete sentence.
   *   This is a callback: a function you provide that gets called
   *   when something interesting happens. It's the same pattern as
   *   addEventListener('click', callback) in the DOM.
   */
  constructor(onSentence: (sentence: string) => void) {
    this.onSentence = onSentence;
  }

  /**
   * Push a new token into the buffer.
   * 
   * HOW SENTENCE DETECTION WORKS:
   * 
   * After appending the token, we scan the buffer for sentence-ending
   * punctuation (. ? !) that's followed by whitespace or is at the end
   * of a multi-character buffer. But we need to be careful:
   * 
   *   "Dr. Smith went home."  — Don't split on "Dr."
   *   "It costs $3.14 total." — Don't split on "3.14"  
   *   "The U.S. is large."    — Don't split on "U.S."
   *   "Really? Yes!"          — Split into two sentences
   * 
   * Our strategy: a period is a sentence boundary ONLY if:
   *   1. It's followed by a space and then an uppercase letter, OR
   *   2. It's followed by a space and a quote character, OR
   *   3. It's at the very end and flush() is called
   * 
   * Question marks and exclamation marks are simpler — they almost
   * always end sentences, so we split on them when followed by a space.
   */
  push(token: string): void {
    this.buffer += token;
    this.emitCompleteSentences();
  }

  /**
   * Flush any remaining text in the buffer.
   * 
   * Called when the LLM signals it's done generating. Whatever text
   * remains — even if it doesn't end with punctuation — gets sent
   * to the callback. The LLM sometimes ends mid-sentence (due to
   * max token limits or stop sequences), and we don't want to
   * silently swallow that text.
   */
  flush(): void {
    const remaining = this.buffer.trim();
    if (remaining.length > 0) {
      this.onSentence(remaining);
      this.buffer = '';
    }
  }

  /**
   * Reset the buffer without emitting anything.
   * Useful when cancelling a generation mid-stream.
   */
  reset(): void {
    this.buffer = '';
  }

  /**
   * Scan the buffer and emit any complete sentences found.
   * 
   * THE REGEX EXPLAINED:
   * 
   *   /([.!?])(\s+)/g
   *    │  │    │  │  │
   *    │  │    │  │  └─ g = global flag, find ALL matches not just the first
   *    │  │    │  └──── \s+ = one or more whitespace characters after punctuation
   *    │  │    └─────── Capture group 2: the whitespace
   *    │  └──────────── [.!?] = any sentence-ending punctuation
   *    └─────────────── Capture group 1: the punctuation mark
   * 
   * We look for punctuation followed by whitespace because:
   * - "Dr. Smith" has a period followed by a space → potential split point
   * - "3.14" has a period NOT followed by a space → not a split point
   * - "end." at the very end has no space after → handled by flush()
   * 
   * After finding a match, we check additional conditions to filter
   * out false positives like abbreviations.
   */
  private emitCompleteSentences(): void {
    // This regex finds punctuation (.!?) followed by whitespace
    const sentenceEndPattern = /([.!?])(\s+)/g;
    let match: RegExpExecArray | null;
    let lastEmitEnd = 0;

    while ((match = sentenceEndPattern.exec(this.buffer)) !== null) {
      const punctuation = match[1];
      const matchEnd = match.index + match[0].length;

      // For periods specifically, check if this is likely an abbreviation
      // Question marks and exclamation marks almost always end sentences
      if (punctuation === '.') {
        if (this.isLikelyAbbreviation(match.index)) {
          continue; // Skip this match, it's probably not a sentence end
        }
      }

      // Extract the sentence (from where we last emitted to this punctuation)
      const sentence = this.buffer.slice(lastEmitEnd, match.index + 1).trim();

      if (sentence.length > 0) {
        this.onSentence(sentence);
      }

      lastEmitEnd = matchEnd;
    }

    // Keep only the un-emitted remainder in the buffer
    if (lastEmitEnd > 0) {
      this.buffer = this.buffer.slice(lastEmitEnd);
    }
  }

  /**
   * Check if a period at the given position is likely part of an abbreviation
   * rather than ending a sentence.
   * 
   * HEURISTICS (not perfect, but good enough for a voice assistant):
   * 
   * 1. Single letter before the period: "U.S.A.", "Dr. J.", "St. Louis"
   *    → Likely abbreviation
   * 
   * 2. Common abbreviations: "Dr.", "Mr.", "Mrs.", "Ms.", "Prof.", "Jr.",
   *    "Sr.", "vs.", "etc.", "approx.", "dept.", "est."
   *    → Definitely abbreviation
   * 
   * 3. Number before the period: "3.14", "$99.99"
   *    → Decimal number, not sentence end
   * 
   * WHY HEURISTICS AND NOT A COMPLETE LIST:
   * A voice assistant doesn't need perfect sentence splitting. If we
   * occasionally split on an abbreviation, the TTS engine still produces
   * understandable speech — just with a slightly odd pause. If we fail
   * to split on a real sentence end, the next sentence catches it or
   * flush() handles it. Good enough beats perfect here.
   */
  private isLikelyAbbreviation(periodIndex: number): boolean {
    // Get the text before the period
    const textBefore = this.buffer.slice(0, periodIndex);

    // Check for common abbreviations
    const abbreviations = [
      'Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Jr', 'Sr',
      'vs', 'etc', 'approx', 'dept', 'est', 'Inc',
      'Ltd', 'Corp', 'Ave', 'Blvd', 'St', 'Rd',
      'Jan', 'Feb', 'Mar', 'Apr', 'Aug', 'Sept',
      'Oct', 'Nov', 'Dec',
    ];

    for (const abbr of abbreviations) {
      if (textBefore.endsWith(abbr)) {
        return true;
      }
    }

    // Single uppercase letter before period: "U.", "A.", "J."
    // Matches patterns like "U.S.A." or "J. K. Rowling"
    if (periodIndex >= 1) {
      const charBefore = this.buffer[periodIndex - 1];
      if (/[A-Z]/.test(charBefore)) {
        // Check it's actually a single letter (not end of a word like "I.")
        if (periodIndex === 1 || /[\s.]/.test(this.buffer[periodIndex - 2])) {
          return true;
        }
      }
    }

    // Number before period: "3.14", "$99.99"
    if (periodIndex >= 1 && /[0-9]/.test(this.buffer[periodIndex - 1])) {
      return true;
    }

    return false;
  }
}