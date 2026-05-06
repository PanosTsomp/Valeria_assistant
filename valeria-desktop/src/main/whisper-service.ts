import { initWhisper } from '@fugood/whisper.node';
import { STTEngine } from '@valeria/core';

type WhisperContext = Awaited<ReturnType<typeof initWhisper>>;

export class WhisperService implements STTEngine {
  private context: WhisperContext | null = null;

  async initialize(modelPath: string): Promise<void> {
    console.log(`Loading Whisper model from: ${modelPath}`);
    const startTime = Date.now();

    this.context = await initWhisper({
      filePath: modelPath,
      useGpu: true,
    }, 'vulkan');

    console.log(`Whisper model loaded in ${Date.now() - startTime}ms`);
  }

  async transcribe(audioFloat32: Float32Array): Promise<string> {
    if (!this.context) {
      throw new Error('Whisper not initialized. Call initialize() first.');
    }

    const int16 = new Int16Array(audioFloat32.length);
    for (let i = 0; i < audioFloat32.length; i++) {
      const clamped = Math.max(-1, Math.min(1, audioFloat32[i]));
      int16[i] = Math.round(clamped * 32767);
    }

    console.log(`Transcribing ${audioFloat32.length} samples (${(audioFloat32.length / 16000).toFixed(1)}s)...`);
    const startTime = Date.now();

    const { promise } = this.context.transcribeData(int16.buffer, {
      language: 'en',
      temperature: 0.0,
      maxLen: 0,
      tokenTimestamps: false,
    });

    const result = await promise;
    console.log(`Transcription completed in ${Date.now() - startTime}ms`);

    if (result?.segments?.length > 0) {
      return result.segments
        .map((segment: { text: string }) => segment.text.trim())
        .join(' ')
        .trim();
    }

    return '';
  }

  dispose(): void {
    if (this.context) {
      this.context.release();
      this.context = null;
      console.log('Whisper model released');
    }
  }
}
