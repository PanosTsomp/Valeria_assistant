# Changelog

All notable changes to the Valeria Assistant project.

---

## [Unreleased] — 2026-05-06

### Changed — valeria-core integration into valeria-desktop
- `WhisperService` now formally implements the `STTEngine` interface from `@valeria/core`
- `LLMService` now formally implements the `LLMEngine` interface from `@valeria/core`
- `LLMService` system prompt replaced with `VALERIA_SYSTEM_PROMPT` from core (single source of truth)
- `LLMService.initialize()` now takes `LLMConfig` instead of reading a hardcoded model path from the constructor
- `WhisperService.initialize()` now takes `modelPath: string` (moved from constructor)
- `main/index.ts` now creates a `Conversation` instance from `@valeria/core` and calls `addMessage()` for every user and assistant turn
- `LLMService.generateStream()` signature updated to `generateStream(messages: Message[])` matching the `LLMEngine` interface
- `valeria-core/src/index.ts` updated to use `export type` for interface-only exports (required for consumers with `isolatedModules: true`)

### Added
- `@valeria/core` linked into `valeria-desktop` as a local file dependency
- Vite alias and TypeScript path mapping for `@valeria/core` so desktop resolves directly to core source
- `CLAUDE.md` — architecture guide and project context for AI-assisted development
- `CHANGELOG.md` — this file

---

## [0.7.0] — 2026-05-06

### Changed — Renderer refactoring (router + component split)
- `App.tsx` rewritten as a nav shell using `MemoryRouter` from `react-router-dom`
- Chat, Audio, and Dev sections extracted into separate page components (`ChatPage`, `AudioPage`, `DevPage`)
- Business logic extracted into custom hooks (`useChat`, `useTranscription`)
- Shared styles extracted to `styles/theme.ts` (color tokens + reusable style objects)
- Dev tools (echo test, streaming test) gated behind `import.meta.env.DEV` — hidden in production builds
- Duplicate `src/hooks/useAudioRecorder.ts` removed; canonical version kept in `renderer/src/hooks/`

### Fixed
- Preload now compiles as CommonJS (`.js`) instead of ESM (`.mjs`) — fixes Electron sandboxed preload not loading
- Preload path in `main/index.ts` corrected to match build output
- `window.electronAPI` null guards added to all hooks and `DevPage` to prevent crashes when running outside Electron context
- `ErrorBoundary` added to `App.tsx` — shows error message in window instead of blank screen on render errors
- DevTools auto-open in dev mode for easier debugging

---

## [0.6.0] — 2026-05-03

### Added — LLM text chat (Milestone 7)
- `LLMService` wrapping `node-llama-cpp` with streaming token generation via async generator
- `chat-send` IPC handler streams tokens to renderer via `sender.send('chat-token', token)`
- `onChatToken` and `onChatComplete` events exposed via preload
- Chat UI in `App.tsx` with message history and live streaming response display
- LLM initializes at app startup alongside Whisper

### Changed
- `package.json` updated to `"type": "module"` for llama-cpp ESM compatibility
- `electron.vite.config.ts` updated to externalise native modules

---

## [0.5.0] — 2026-04-09 to 2026-04-11

### Added — Whisper transcription (Milestone 6)
- `WhisperService` wrapping `@fugood/whisper.node` with GPU support via Vulkan backend
- `transcribe-audio` IPC handler — receives Float32Array samples, returns transcript text
- Auto-transcription triggered after recording stops
- Transcription result and timing displayed in UI
- Float32 → Int16 conversion for Whisper compatibility

### Fixed
- Audio GPU backend selection tested across CUDA, Vulkan, and CPU fallback

---

## [0.4.0] — 2026-04-03

### Added — Microphone recording + audio playback (Milestone 5)
- `useAudioRecorder` hook: MediaRecorder capture → AudioContext decode → OfflineAudioContext resample to 16kHz mono
- `save-audio` IPC handler: writes 44-byte WAV header + PCM samples to `~/.config/valeria-desktop/audio/`
- `read-audio-file` IPC handler: reads WAV back for playback
- `get-last-recording` IPC handler: returns file path
- Audio playback via Web Audio API (`AudioContext.decodeAudioData` + `BufferSource`)
- Recording UI with start/stop button and pulsing indicator

### Fixed
- WAV decode failure caused by incorrect buffer slice — fixed with proper `byteOffset` handling
- Playback fetch error resolved by switching from URL-based to IPC-based audio loading

---

## [0.3.0] — 2026-04-03

### Added — IPC foundation (Milestone 4)
- Preload script (`preload/index.ts`) exposing `window.electronAPI` via `contextBridge`
- Type declarations (`preload/index.d.ts`) for renderer TypeScript safety
- `echo` invoke/handle IPC test — round-trip latency check
- Streaming test — simulates token-by-token LLM output via `sender.send()`
- React renderer bootstrapped with Vite and `@vitejs/plugin-react`

---

## [0.2.0] — 2026-03-26 to 2026-03-27

### Added — Electron app init
- `valeria-desktop` Electron app scaffolded with `electron-vite`
- BrowserWindow with sandboxed renderer (`sandbox: true`)
- App lifecycle handlers (ready, activate, window-all-closed)

---

## [0.1.0] — 2026-03-16 to 2026-03-26

### Added — valeria-core library
- `types.ts`: `Message`, `LLMConfig`, `STTEngine`, `LLMEngine`, `TTSEngine` interfaces
- `conversation.ts`: `Conversation` class with `addMessage`, `getMessages`, `getHistory`, `trimHistory`, `clear`; `VALERIA_SYSTEM_PROMPT` constant
- `sentence-buffer.ts`: `SentenceBuffer` — accumulates streaming tokens and emits complete sentences, handles abbreviations and decimal numbers
- `pipeline.ts`: `Pipeline` class — full voice loop state machine (idle → listening → thinking → speaking → idle) with dependency-injected engines and event callbacks
- Full test suite with Vitest covering all three core classes
- `index.ts` public API exports

---

## [0.0.1] — 2025-05-10 to 2026-03-13

### Added — Project init
- Repository structure established
- Initial project scaffolding
