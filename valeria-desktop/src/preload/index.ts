// src/preload/index.ts

import { contextBridge, ipcRenderer } from 'electron'

/**
 * The preload script bridges the main and renderer processes.
 *
 * contextBridge.exposeInMainWorld() creates a property on the
 * renderer's window object. The renderer can then call these
 * methods as if they were normal JavaScript functions — but
 * under the hood, each call crosses the process boundary via IPC.
 *
 * WHY NOT JUST EXPOSE ipcRenderer DIRECTLY?
 * That would give the renderer full IPC access — it could send
 * any message to any handler, including ones you didn't intend.
 * By wrapping specific calls in named functions, you create a
 * controlled API surface. The renderer can only do what you
 * explicitly allow here.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Echo test — invoke/handle pattern.
   * Returns a Promise that resolves with the main process's response.
   */
  echo: (message: string): Promise<string> => {
    return ipcRenderer.invoke('echo', message)
  },

  /**
   * Start the streaming test — triggers token-by-token events.
   * Returns a Promise with the final result (token count).
   */
  startStreamingTest: (): Promise<{ tokenCount: number }> => {
    return ipcRenderer.invoke('start-streaming-test')
  },

  /**
   * Listen for streamed tokens from the main process.
   *
   * This registers a callback that fires every time the main
   * process sends a 'stream-token' event. Returns a cleanup
   * function to remove the listener (prevents memory leaks).
   *
   * The cleanup function pattern is important — React components
   * mount and unmount, and each mount registers a new listener.
   * Without cleanup, you'd accumulate duplicate listeners.
   */
  onStreamToken: (callback: (token: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, token: string): void => {
      callback(token)
    }
    ipcRenderer.on('stream-token', handler)

    // Return cleanup function
    return (): void => {
      ipcRenderer.removeListener('stream-token', handler)
    }
  },

  /**
   * Listen for the stream-complete signal.
   * Same pattern as onStreamToken.
   */
  onStreamComplete: (callback: () => void) => {
    const handler = (): void => {
      callback()
    }
    ipcRenderer.on('stream-complete', handler)

    return (): void => {
      ipcRenderer.removeListener('stream-complete', handler)
    }
  },

  /**
   * Send recorded audio samples to the main process for saving.
   * We convert Float32Array to a regular array for IPC transport.
   */
  saveAudio: (samples: Float32Array): Promise<{ filePath: string; sampleCount: number }> => {
    return ipcRenderer.invoke('save-audio', Array.from(samples));
  },

  // === Whisper transcription (milestone 6) ===
  transcribeAudio: (samples: Float32Array): Promise<{ text: string; error: string | null }> => {
    return ipcRenderer.invoke('transcribe-audio', Array.from(samples));
  },

  /**
   * Get the file path of the last recording (for playback).
   */
  getLastRecording: (): Promise<string | null> => {
    return ipcRenderer.invoke('get-last-recording');
  },

  readAudioFile: (): Promise<number[] | null> => {
    return ipcRenderer.invoke('read-audio-file');
  },

  // === LLM chat channels (milestone 7) ===
  chatSend: (message: string): Promise<{ response: string; error: string | null }> => {
    return ipcRenderer.invoke('chat-send', message);
  },

  onChatToken: (callback: (token: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, token: string): void => {
      callback(token);
    };
    ipcRenderer.on('chat-token', handler);
    return (): void => {
      ipcRenderer.removeListener('chat-token', handler);
    };
  },

  onChatComplete: (callback: () => void) => {
    const handler = (): void => {
      callback();
    };
    ipcRenderer.on('chat-complete', handler);
    return (): void => {
      ipcRenderer.removeListener('chat-complete', handler);
    };
  },

    // === TTS channels (milestone 8) ===
  ttsSynthesize: (text: string): Promise<{
    samples: number[] | null;
    sampleRate: number;
    error: string | null;
  }> => {
    return ipcRenderer.invoke('tts-synthesize', text);
  },

  
})
