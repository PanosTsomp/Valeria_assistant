// src/renderer/src/App.tsx

import { useState, useEffect, useCallback } from 'react'
import { useAudioRecorder } from './hooks/useAudioRecorder'

function App(): React.JSX.Element {
  // Chat state (milestone 7)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([])
  const [currentResponse, setCurrentResponse] = useState('')
  const [isChatting, setIsChatting] = useState(false)

  // Audio state (milestone 5)
  const { isRecording, error: recordError, startRecording, stopRecording } = useAudioRecorder()
  const [audioStatus, setAudioStatus] = useState('')
  const [savedFilePath, setSavedFilePath] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)

  // Transcription state (milestone 6)
  const [transcript, setTranscript] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcribeTime, setTranscribeTime] = useState(0)

  // Echo + streaming state (milestone 4)
  const [echoInput, setEchoInput] = useState('')
  const [echoResponse, setEchoResponse] = useState('')
  const [streamedText, setStreamedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [tokenCount, setTokenCount] = useState(0)

  // ============================================================
  // CHAT (milestone 7)
  // ============================================================

  const handleChatSend = useCallback(async () => {
    if (chatInput.trim() === '' || isChatting) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setCurrentResponse('')
    setIsChatting(true)

    setChatMessages((prev) => [...prev, { role: 'user', content: userMessage }])

    const result = await window.electronAPI.chatSend(userMessage)

    if (result.response) {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: result.response }])
    }

    setCurrentResponse('')
    setIsChatting(false)
  }, [chatInput, isChatting])

  useEffect(() => {
    const cleanupToken = window.electronAPI.onChatToken((token) => {
      setCurrentResponse((prev) => prev + token)
    })
    const cleanupComplete = window.electronAPI.onChatComplete(() => {
      // Completion is handled in handleChatSend
    })
    return () => {
      cleanupToken()
      cleanupComplete()
    }
  }, [])

  // ============================================================
  // AUDIO RECORDING + TRANSCRIPTION (milestones 5-6)
  // ============================================================

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      setAudioStatus('Processing audio...')
      const samples = await stopRecording()

      if (samples) {
        const duration = (samples.length / 16000).toFixed(1)
        setAudioStatus(`Captured ${samples.length} samples (${duration}s). Saving...`)

        const saveResult = await window.electronAPI.saveAudio(samples)
        setSavedFilePath(saveResult.filePath)

        setIsTranscribing(true)
        setTranscript('')
        setAudioStatus(`Saved! Now transcribing ${duration}s of audio...`)

        const startTime = Date.now()
        const result = await window.electronAPI.transcribeAudio(samples)
        const elapsed = Date.now() - startTime
        setTranscribeTime(elapsed)
        setIsTranscribing(false)

        if (result.error) {
          setAudioStatus(`Transcription error: ${result.error}`)
        } else if (result.text) {
          setTranscript(result.text)
          setAudioStatus(`Transcribed in ${elapsed}ms`)
        } else {
          setAudioStatus('No speech detected.')
        }
      } else {
        setAudioStatus('No audio captured.')
      }
    } else {
      setAudioStatus('')
      setSavedFilePath('')
      setTranscript('')
      setTranscribeTime(0)
      await startRecording()
      setAudioStatus('Recording... (speak now)')
    }
  }, [isRecording, startRecording, stopRecording])

  const handlePlayback = useCallback(async () => {
    if (!savedFilePath) return
    try {
      setIsPlaying(true)

      const audioBytes = await window.electronAPI.readAudioFile()
      if (!audioBytes) {
        setAudioStatus('No recording found.')
        setIsPlaying(false)
        return
      }

      const uint8 = new Uint8Array(audioBytes)
      const arrayBuffer = uint8.buffer.slice(
        uint8.byteOffset,
        uint8.byteOffset + uint8.byteLength
      )

      const audioContext = new AudioContext()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContext.destination)
      source.onended = () => {
        setIsPlaying(false)
        audioContext.close()
      }
      source.start(0)
    } catch (err) {
      console.error('Playback error:', err)
      setAudioStatus(`Playback error: ${err instanceof Error ? err.message : 'unknown'}`)
      setIsPlaying(false)
    }
  }, [savedFilePath])

  // ============================================================
  // ECHO + STREAMING (milestone 4)
  // ============================================================

  const handleEcho = useCallback(async () => {
    if (echoInput.trim() === '') return
    const response = await window.electronAPI.echo(echoInput)
    setEchoResponse(response)
  }, [echoInput])

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
  // STYLES
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
    cursor: active ? 'not-allowed' : 'pointer',
    fontWeight: 500,
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
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 4, color: '#ffffff' }}>
        Valeria
      </h1>
      <p style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>
        Milestone 7 — Text Chat with LLM
      </p>

      {/* ===== CHAT WITH VALERIA ===== */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>Chat with Valeria</h2>

        {/* Message history */}
        <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              style={{
                padding: '10px 14px',
                marginBottom: 8,
                borderRadius: 8,
                background: msg.role === 'user' ? '#0f3460' : '#1a2e1a',
                borderLeft: `3px solid ${msg.role === 'user' ? '#42a5f5' : '#4caf50'}`
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: msg.role === 'user' ? '#42a5f5' : '#4caf50',
                  marginBottom: 4,
                  fontWeight: 500
                }}
              >
                {msg.role === 'user' ? 'YOU' : 'VALERIA'}
              </div>
              <div style={{ fontSize: 14, color: '#e0e0e0', lineHeight: 1.6 }}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Current streaming response */}
          {currentResponse && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: 8,
                borderRadius: 8,
                background: '#1a2e1a',
                borderLeft: '3px solid #4caf50'
              }}
            >
              <div style={{ fontSize: 11, color: '#4caf50', marginBottom: 4, fontWeight: 500 }}>
                VALERIA
              </div>
              <div style={{ fontSize: 14, color: '#e0e0e0', lineHeight: 1.6 }}>
                {currentResponse}
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 16,
                    background: '#4caf50',
                    marginLeft: 2,
                    animation: 'blink 0.8s infinite'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Chat input */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleChatSend()
            }}
            placeholder={isChatting ? 'Valeria is thinking...' : 'Ask Valeria something...'}
            disabled={isChatting}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #2a2a4a',
              background: '#0f3460',
              color: '#e0e0e0',
              fontSize: 14,
              outline: 'none',
              opacity: isChatting ? 0.6 : 1
            }}
          />
          <button onClick={handleChatSend} disabled={isChatting} style={buttonStyle(isChatting)}>
            {isChatting ? '...' : 'Send'}
          </button>
        </div>
      </div>

      {/* ===== MICROPHONE RECORDING ===== */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>Microphone recording</h2>

        {/* Button row */}
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

        {/* Error display */}
        {recordError && (
          <div style={{ ...infoBoxStyle, color: '#ef5350' }}>Error: {recordError}</div>
        )}

        {/* Audio status */}
        {audioStatus && <div style={{ ...infoBoxStyle, color: '#90caf9' }}>{audioStatus}</div>}

        {/* Transcription in progress */}
        {isTranscribing && (
          <div style={{ ...infoBoxStyle, color: '#ffd54f' }}>Transcribing with Whisper...</div>
        )}

        {/* Transcript result */}
        {transcript && (
          <div
            style={{
              marginTop: 12,
              padding: '14px 16px',
              background: '#1a2e1a',
              borderRadius: 8,
              borderLeft: '3px solid #4caf50'
            }}
          >
            <div style={{ fontSize: 12, color: '#4caf50', marginBottom: 6, fontWeight: 500 }}>
              TRANSCRIPT ({transcribeTime}ms)
            </div>
            <div style={{ fontSize: 15, color: '#c8e6c9', lineHeight: 1.6 }}>{transcript}</div>
          </div>
        )}
      </div>

      {/* ===== ECHO TEST ===== */}
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

      {/* ===== STREAMING TEST ===== */}
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
          <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
            Received {tokenCount} tokens
          </p>
        )}
      </div>

      {/* Animations */}
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
