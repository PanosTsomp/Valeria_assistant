// src/renderer/src/App.tsx

import { useState, useEffect, useCallback } from 'react'

/**
 * The main Valeria UI component.
 *
 * For milestone 4, this is a simple test interface with:
 * 1. An echo test (type a message, get a response from main process)
 * 2. A streaming test (watch tokens appear one by one)
 *
 * In milestone 9, this will become the full voice assistant UI.
 */
function App(): React.JSX.Element {
  // ============================================================
  // STATE
  // ============================================================

  /**
   * useState creates a piece of state and a function to update it.
   * When you call the setter (e.g., setEchoInput), React re-renders
   * the component with the new value. This is how React knows
   * something changed and the UI needs to update.
   */
  const [echoInput, setEchoInput] = useState('')
  const [echoResponse, setEchoResponse] = useState('')
  const [streamedText, setStreamedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [tokenCount, setTokenCount] = useState(0)

  // ============================================================
  // ECHO TEST
  // ============================================================

  /**
   * useCallback memoizes the function — it creates it once and reuses
   * it across re-renders instead of creating a new function every time.
   * Not strictly necessary here but it's a good React habit.
   */
  const handleEcho = useCallback(async () => {
    if (echoInput.trim() === '') return

    // This calls the preload's echo function, which calls
    // ipcRenderer.invoke('echo', message), which triggers
    // ipcMain.handle('echo', ...) in the main process.
    // The whole round-trip takes milliseconds.
    const response = await window.electronAPI.echo(echoInput)
    setEchoResponse(response)
  }, [echoInput])

  // ============================================================
  // STREAMING TEST
  // ============================================================

  const handleStreamingTest = useCallback(async () => {
    // Reset state for new test
    setStreamedText('')
    setIsStreaming(true)
    setTokenCount(0)

    // Start the streaming process in main
    // This returns when all tokens have been sent
    const result = await window.electronAPI.startStreamingTest()
    setTokenCount(result.tokenCount)
  }, [])

  /**
   * useEffect sets up side effects — things that happen outside
   * of React's render cycle. Here, we're registering IPC listeners.
   *
   * The empty dependency array [] means this runs once when the
   * component first appears (mounts), and the cleanup function
   * runs when the component disappears (unmounts).
   *
   * WHY CLEANUP MATTERS:
   * Without the cleanup functions, every time React re-renders
   * this component, new listeners would be added without removing
   * the old ones. You'd get duplicate token events, and eventually
   * a memory leak.
   */
  useEffect(() => {
    // Register token listener
    const cleanupToken = window.electronAPI.onStreamToken((token) => {
      setStreamedText((prev) => prev + token)
    })

    // Register completion listener
    const cleanupComplete = window.electronAPI.onStreamComplete(() => {
      setIsStreaming(false)
    })

    // Cleanup: remove listeners when component unmounts
    return () => {
      cleanupToken()
      cleanupComplete()
    }
  }, [])

  // ============================================================
  // RENDER
  // ============================================================

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
      {/* Header */}
      <h1
        style={{
          fontSize: 28,
          fontWeight: 600,
          marginBottom: 4,
          color: '#ffffff'
        }}
      >
        Valeria
      </h1>
      <p
        style={{
          fontSize: 14,
          color: '#888',
          marginBottom: 32
        }}
      >
        Milestone 4 — Electron IPC Test
      </p>

      {/* Echo Test Section */}
      <div
        style={{
          background: '#16213e',
          borderRadius: 12,
          padding: 20,
          marginBottom: 16
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 12, color: '#ccc' }}>
          Echo test (invoke/handle)
        </h2>
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
          <button
            onClick={handleEcho}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#533483',
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Send
          </button>
        </div>
        {echoResponse && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 14px',
              background: '#0a1628',
              borderRadius: 8,
              fontSize: 14,
              color: '#90caf9',
              fontFamily: 'monospace'
            }}
          >
            {echoResponse}
          </div>
        )}
      </div>

      {/* Streaming Test Section */}
      <div
        style={{
          background: '#16213e',
          borderRadius: 12,
          padding: 20,
          marginBottom: 16
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 12, color: '#ccc' }}>
          Streaming test (send/on)
        </h2>
        <button
          onClick={handleStreamingTest}
          disabled={isStreaming}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: isStreaming ? '#2a2a4a' : '#533483',
            color: isStreaming ? '#666' : '#fff',
            fontSize: 14,
            cursor: isStreaming ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            marginBottom: 12
          }}
        >
          {isStreaming ? 'Streaming...' : 'Start streaming test'}
        </button>
        {streamedText && (
          <div
            style={{
              padding: '10px 14px',
              background: '#0a1628',
              borderRadius: 8,
              fontSize: 14,
              color: '#a5d6a7',
              fontFamily: 'monospace',
              minHeight: 40,
              lineHeight: 1.6
            }}
          >
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

      {/* Info */}
      <div
        style={{
          background: '#16213e',
          borderRadius: 12,
          padding: 20,
          fontSize: 13,
          color: '#666',
          lineHeight: 1.7
        }}
      >
        <p>
          <strong style={{ color: '#888' }}>Echo test</strong> demonstrates the invoke/handle IPC
          pattern — send a message, get one response. This is how STT and TTS calls will work.
        </p>
        <p style={{ marginTop: 8 }}>
          <strong style={{ color: '#888' }}>Streaming test</strong> demonstrates the send/on pattern
          — main pushes multiple events to the renderer. This is how LLM tokens will stream to the
          UI.
        </p>
      </div>

      {/* Blinking cursor animation */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export default App
