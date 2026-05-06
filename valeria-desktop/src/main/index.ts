// src/main/index.ts

import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { WhisperService } from './whisper-service';
import { LLMService } from './llm-service';
let llmService: LLMService | null = null;


/**
 * Create the main application window.
 *
 * BrowserWindow is Electron's window class. Each window gets its own
 * renderer process (its own Chromium instance). Most apps have one
 * window, but you could create multiple.
 */
function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 500,
    height: 700,
    minWidth: 400,
    minHeight: 500,
    title: 'Valeria',
    // webPreferences controls the renderer's capabilities
    webPreferences: {
      // The preload script path — this runs before the page loads
      preload: join(__dirname, '../preload/index.js'),
      // sandbox: true means the renderer has NO Node.js access
      // (this is the default in modern Electron, but being explicit)
      sandbox: true
    }
  })

  // In development, load from the Vite dev server (hot reloading)
  // In production, load from the built HTML file
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// ============================================================
// IPC HANDLERS
// ============================================================

/**
 * Echo handler — a simple round-trip test.
 *
 * ipcMain.handle() registers a handler for invoke-style IPC.
 * When the renderer calls window.electronAPI.echo("hello"),
 * this function runs in the main process and the return value
 * is sent back to the renderer as the resolved Promise.
 *
 * This is the "invoke/handle" pattern — like a function call
 * across processes. The renderer invokes, the main handles.
 */
ipcMain.handle('echo', async (_event, message: string) => {
  // In a real app, this is where you'd do heavy work:
  // transcribe audio, run the LLM, read files, etc.
  // For now, just echo the message back.
  return `Main process received: "${message}"`
})

/**
 * Streaming test handler — simulates how LLM tokens will flow.
 *
 * Unlike echo (which returns one value), this sends multiple
 * events over time using webContents.send(). The renderer
 * listens for these events and displays each one as it arrives.
 *
 * This is the "send/on" pattern — like a live stream.
 * The main process sends whenever it wants, the renderer listens.
 *
 * In milestone 7, this exact pattern will stream LLM tokens.
 */
ipcMain.handle('start-streaming-test', async (event) => {
  const sender = event.sender
  const tokens = [
    'Hello',
    ',',
    ' I',
    ' am',
    ' Valeria',
    '.',
    ' How',
    ' can',
    ' I',
    ' help',
    ' you',
    ' today',
    '?'
  ]

  for (const token of tokens) {
    // Send each token to the renderer with a small delay
    // to simulate real LLM generation speed
    await new Promise((resolve) => setTimeout(resolve, 100))
    sender.send('stream-token', token)
  }

  // Signal that streaming is complete
  sender.send('stream-complete')
  return { tokenCount: tokens.length }
})

// ============================================================
// APP LIFECYCLE
// ============================================================

/**
 * app.whenReady() resolves when Electron has finished initializing.
 * This is where you create windows and set up the app.
 */
// Global Whisper service
let whisperService: WhisperService | null = null;

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.valeria.assistant');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Initialize Whisper (existing code)
  const whisperModelPath = join(app.getAppPath(), 'models', 'ggml-tiny.en.bin');
  try {
    whisperService = new WhisperService(whisperModelPath);
    await whisperService.initialize();
    console.log('Whisper ready!');
  } catch (err) {
    console.error('Failed to initialize Whisper:', err);
  }

  // Initialize LLM
  const llmModelPath = join(
    app.getAppPath(),
    'models',
    'Phi-3.5-mini-instruct-Q4_K_M.gguf'
  );
  try {
    llmService = new LLMService(llmModelPath);
    await llmService.initialize();
    console.log('LLM ready!');
  } catch (err) {
    console.error('Failed to initialize LLM:', err);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * Quit the app when all windows are closed.
 * Exception: on macOS, apps stay active until Cmd+Q.
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ============================================================
// AUDIO IPC HANDLERS
// ============================================================

/**
 * Directory to store temporary audio files.
 * app.getPath('userData') gives us the app's data directory:
 * On Linux: ~/.config/valeria-desktop/
 * This persists between app launches but is specific to this app.
 */
function getAudioDir(): string {
  const dir = join(app.getPath('userData'), 'audio')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

// ============================================================
// WHISPER IPC HANDLER
// ============================================================

/**
 * Transcribe audio samples using Whisper.
 * 
 * Receives Float32Array samples (as a regular number array via IPC),
 * passes them to WhisperService, returns the transcript text.
 */
ipcMain.handle(
  'transcribe-audio',
  async (_event, samples: number[]) => {
    if (!whisperService) {
      return { error: 'Whisper not initialized', text: '' };
    }

    try {
      const float32 = new Float32Array(samples);
      const text = await whisperService.transcribe(float32);
      return { text, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transcription failed';
      console.error('Transcription error:', message);
      return { text: '', error: message };
    }
  }
);

/**
 * Receive recorded audio from the renderer and save as .wav file.
 *
 * The renderer sends a Float32Array of PCM samples at 16kHz mono.
 * We wrap it in a WAV header and write to disk. This file can be:
 * 1. Played back to verify the recording (this milestone)
 * 2. Fed directly to whisper.cpp for transcription (milestone 6)
 *
 * WAV FORMAT:
 * A .wav file is just raw audio samples with a 44-byte header that
 * describes the format (sample rate, bit depth, channels). The header
 * is a fixed structure — once you understand it, you can create .wav
 * files from any raw audio data.
 */
ipcMain.handle('save-audio', async (_event, samples: number[]) => {
  // The renderer sends a regular array (IPC can't transfer Float32Array
  // directly in all Electron versions). Convert back to Float32Array.
  const float32 = new Float32Array(samples)

  const wavBuffer = createWavBuffer(float32, 16000)
  const filePath = join(getAudioDir(), 'last-recording.wav')
  writeFileSync(filePath, wavBuffer)

  return { filePath, sampleCount: float32.length }
})

/**
 * Get the path to the last recording for playback.
 */
ipcMain.handle('get-last-recording', async () => {
  const filePath = join(getAudioDir(), 'last-recording.wav')
  if (existsSync(filePath)) {
    return filePath
  }
  return null
})

/**
 * Create a WAV file buffer from raw PCM samples.
 *
 * WAV HEADER STRUCTURE (44 bytes):
 * Bytes 0-3:   "RIFF" (file type identifier)
 * Bytes 4-7:   File size minus 8 bytes
 * Bytes 8-11:  "WAVE" (format identifier)
 * Bytes 12-15: "fmt " (format chunk marker)
 * Bytes 16-19: 16 (format chunk size)
 * Bytes 20-21: 3 (audio format: 3 = IEEE float, 1 = PCM integer)
 * Bytes 22-23: 1 (number of channels: 1 = mono)
 * Bytes 24-27: Sample rate (16000)
 * Bytes 28-31: Byte rate (sample rate × channels × bytes per sample)
 * Bytes 32-33: Block align (channels × bytes per sample)
 * Bytes 34-35: Bits per sample (32 for float)
 * Bytes 36-39: "data" (data chunk marker)
 * Bytes 40-43: Data size in bytes
 * Bytes 44+:   The actual audio samples
 *
 * This is not a library — it's 44 bytes of binary. Understanding it
 * demystifies audio files: they're just numbers with a label.
 */
function createWavBuffer(samples: Float32Array, sampleRate: number): Buffer {
  const numChannels = 1
  const bitsPerSample = 32
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const headerSize = 44
  const fileSize = headerSize + dataSize

  const buffer = Buffer.alloc(fileSize)

  // RIFF header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(fileSize - 8, 4)
  buffer.write('WAVE', 8)

  // fmt chunk
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // chunk size
  buffer.writeUInt16LE(3, 20) // format: IEEE float
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)

  // data chunk
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  // Write samples
  for (let i = 0; i < samples.length; i++) {
    buffer.writeFloatLE(samples[i], headerSize + i * bytesPerSample)
  }

  return buffer
}

ipcMain.handle('read-audio-file', async () => {
  const filePath = join(getAudioDir(), 'last-recording.wav')
  if (existsSync(filePath)) {
    const { readFileSync } = await import('fs')
    const buffer = readFileSync(filePath)
    // Convert to regular array for IPC transport
    return Array.from(new Uint8Array(buffer))
  }
  return null
})

// ============================================================
// LLM CHAT IPC HANDLER
// ============================================================

/**
 * Handle a chat message from the renderer.
 * 
 * Starts LLM generation and streams tokens back via send/on pattern.
 * Returns the final complete response.
 */
ipcMain.handle(
  'chat-send',
  async (event, message: string) => {
    if (!llmService) {
      return { error: 'LLM not initialized', response: '' };
    }

    const sender = event.sender;

    try {
      let fullResponse = '';

      for await (const token of llmService.generateStream(message)) {
        fullResponse += token;
        // Stream each token to the renderer
        sender.send('chat-token', token);
      }

      // Signal completion
      sender.send('chat-complete');

      return { response: fullResponse, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      console.error('Chat error:', message);
      sender.send('chat-complete');
      return { response: '', error: message };
    }
  }
);

app.on('before-quit', async () => {
  if (whisperService) {
    await whisperService.dispose();
  }
  if (llmService) {
    await llmService.dispose();
  }
});


