// src/renderer/src/App.tsx

import { useState, useEffect, useCallback } from 'react'
import { useAudioRecorder } from './hooks/useAudioRecorder'

function App(): React.JSX.Element {
  // Existing state from milestone 4
  const [echoInput, setEchoInput] = useState('')
  const [echoResponse, setEchoResponse] = useState('')
  const [streamedText, setStreamedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [tokenCount, setTokenCount] = useState(0)

  // New audio state
  const { isRecording, error: recordError, startRecording, stopRecording } = useAudioRecorder()
  const [audioStatus, setAudioStatus] = useState('')
  const [savedFilePath, setSavedFilePath] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)

  // ============================================================
  // ECHO (from milestone 4)
  // ============================================================

  const handleEcho = useCallback(async () => {
    if (echoInput.trim() === '') return
    const response = await window.electronAPI.echo(echoInput)
    setEchoResponse(response)
  }, [echoInput])

  // ============================================================
  // STREAMING (from milestone 4)
  // ============================================================

  const handleStreamingTest = useCallback(async () => {
    setStreamedText('')
    setIsStreaming(true)
    setTokenCount(0)
    const result = await window.electronAPI.startStreamingTest()
    setTokenCount(result.tokenCount)
  }, [])

  useEffect(() => {
    const cleanupToken = window.electronAPI.onStreamToken((token) => {
      setStreamedText((prev) => prev + token)
    })
    const cleanupComplete = window.electronAPI.onStreamComplete(() => {
      setIsStreaming(false)
    })
    return () => {
      cleanupToken()
      cleanupComplete()
    }
  }, [])

  // ============================================================
  // AUDIO RECORDING (new in milestone 5)
  // ============================================================

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      setAudioStatus('Processing audio...')
      const samples = await stopRecording()

      if (samples) {
        setAudioStatus(
          `Captured ${samples.length} samples (${(samples.length / 16000).toFixed(1)}s). Saving...`
        )

        // Send to main process for saving
        const result = await window.electronAPI.saveAudio(samples)
        setSavedFilePath(result.filePath)
        setAudioStatus(
          `Saved! ${result.sampleCount} samples (${(result.sampleCount / 16000).toFixed(1)}s) → ${result.filePath}`
        )
      } else {
        setAudioStatus('No audio captured.')
      }
    } else {
      setAudioStatus('')
      setSavedFilePath('')
      await startRecording()
      setAudioStatus('Recording...')
    }
  }, [isRecording, startRecording, stopRecording])

  /**
   * Playback: read the saved .wav file and play it in the browser.
   *
   * We fetch the file using Electron's custom protocol or file:// URL,
   * decode it, and play it through the Web Audio API. This proves the
   * recording pipeline is working end-to-end.
   */
  const handlePlayback = useCallback(async () => {
    if (!savedFilePath) return;
    try {
      setIsPlaying(true);

      const audioBytes = await window.electronAPI.readAudioFile();
      if (!audioBytes) {
        setAudioStatus('No recording found.');
        setIsPlaying(false);
        return;
      }

      const uint8 = new Uint8Array(audioBytes);
      const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);

      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.onended = () => {
        setIsPlaying(false);
        audioContext.close();
      };
      source.start(0);
    } catch (err) {
      console.error('Playback error:', err);
      setAudioStatus(`Playback error: ${err instanceof Error ? err.message : 'unknown'}`);
      setIsPlaying(false);
    }
  }, [savedFilePath])

  // ============================================================
  // RENDER
  // ============================================================

  const sectionStyle = {
    background: '#16213e',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16
  }

  const headingStyle = {
    fontSize: 16,
    fontWeight: 500 as const,
    marginBottom: 12,
    color: '#ccc'
  }

  const buttonStyle = (active: boolean, color: string = '#533483'): React.CSSProperties => ({
    padding: '10px 20px',
    borderRadius: 8,
    border: 'none',
    background: active ? '#2a2a4a' : color,
    color: active ? '#666' : '#fff',
    fontSize: 14,
    cursor: active ? ('not-allowed' as const) : ('pointer' as const),
    fontWeight: 500 as const,
    marginRight: 8
  })

  const infoBoxStyle = {
    marginTop: 12,
    padding: '10px 14px',
    background: '#0a1628',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 1.6
  }

  return (
    <div
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        maxWidth: 460,
        margin: '0 auto',
        padding: 24,
        color: '#e0e0e0',
        minHeight: '100vh',
        background: '#1a1a2e'
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 4, color: '#ffffff' }}>Valeria</h1>
      <p style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>
        Milestone 5 — Microphone Capture
      </p>

      {/* ===== AUDIO RECORDING ===== */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>Microphone recording</h2>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={handleToggleRecording}
            style={{
              ...buttonStyle(false, isRecording ? '#dc2626' : '#533483'),
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            {isRecording && (
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#ff4444',
                  animation: 'pulse 1s infinite'
                }}
              />
            )}
            {isRecording ? 'Stop recording' : 'Start recording'}
          </button>

          {savedFilePath && (
            <button
              onClick={handlePlayback}
              disabled={isPlaying}
              style={buttonStyle(isPlaying, '#1e6f50')}
            >
              {isPlaying ? 'Playing...' : 'Play back'}
            </button>
          )}
        </div>

        {recordError && (
          <div style={{ ...infoBoxStyle, color: '#ef5350' }}>Error: {recordError}</div>
        )}

        {audioStatus && <div style={{ ...infoBoxStyle, color: '#90caf9' }}>{audioStatus}</div>}
      </div>

      {/* ===== ECHO TEST (from milestone 4) ===== */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>Echo test (invoke/handle)</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={echoInput}
            onChange={(e) => setEchoInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEcho()
            }}
            placeholder="Type a message..."
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #2a2a4a',
              background: '#0f3460',
              color: '#e0e0e0',
              fontSize: 14,
              outline: 'none'
            }}
          />
          <button onClick={handleEcho} style={buttonStyle(false)}>
            Send
          </button>
        </div>
        {echoResponse && <div style={{ ...infoBoxStyle, color: '#90caf9' }}>{echoResponse}</div>}
      </div>

      {/* ===== STREAMING TEST (from milestone 4) ===== */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>Streaming test (send/on)</h2>
        <button
          onClick={handleStreamingTest}
          disabled={isStreaming}
          style={buttonStyle(isStreaming)}
        >
          {isStreaming ? 'Streaming...' : 'Start streaming test'}
        </button>
        {streamedText && (
          <div style={{ ...infoBoxStyle, color: '#a5d6a7', minHeight: 40 }}>
            {streamedText}
            {isStreaming && (
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 16,
                  background: '#a5d6a7',
                  marginLeft: 2,
                  animation: 'blink 0.8s infinite'
                }}
              />
            )}
          </div>
        )}
        {!isStreaming && tokenCount > 0 && (
          <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>Received {tokenCount} tokens</p>
        )}
      </div>

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

export default App
