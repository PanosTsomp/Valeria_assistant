// src/preload/index.d.ts

/**
 * Type declarations for the electronAPI exposed by the preload script.
 *
 * Without this file, TypeScript would complain every time the renderer
 * accesses window.electronAPI — it doesn't know that property exists.
 * This declaration file tells TypeScript: "trust me, window.electronAPI
 * exists and has these methods."
 */
declare global {
  interface Window {
    electronAPI: {
      echo: (message: string) => Promise<string>
      startStreamingTest: () => Promise<{ tokenCount: number }>
      onStreamToken: (callback: (token: string) => void) => () => void
      onStreamComplete: (callback: () => void) => () => void
      saveAudio: (samples: Float32Array) => Promise<{ filePath: string; sampleCount: number }>
      getLastRecording: () => Promise<string | null>
      readAudioFile: () => Promise<number[] | null>
    }
  }
}

export {}
