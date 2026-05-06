import { useState, useEffect, useCallback } from 'react'
import { sectionStyle, headingStyle, buttonStyle, infoBoxStyle, inputStyle, colors } from '../styles/theme'

export default function DevPage(): React.JSX.Element {
  const [echoInput, setEchoInput] = useState('')
  const [echoResponse, setEchoResponse] = useState('')
  const [streamedText, setStreamedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [tokenCount, setTokenCount] = useState(0)

  const handleEcho = useCallback(async () => {
    if (echoInput.trim() === '' || !window.electronAPI) return
    const response = await window.electronAPI.echo(echoInput)
    setEchoResponse(response)
  }, [echoInput])

  const handleStreamingTest = useCallback(async () => {
    if (!window.electronAPI) return
    setStreamedText('')
    setIsStreaming(true)
    setTokenCount(0)
    const result = await window.electronAPI.startStreamingTest()
    setTokenCount(result.tokenCount)
  }, [])

  useEffect(() => {
    if (!window.electronAPI) return
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

  return (
    <div>
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
            style={inputStyle}
          />
          <button onClick={handleEcho} style={buttonStyle(false)}>
            Send
          </button>
        </div>
        {echoResponse && (
          <div style={{ ...infoBoxStyle, color: colors.blueStatus }}>{echoResponse}</div>
        )}
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Streaming test (send/on)</h2>
        <button onClick={handleStreamingTest} disabled={isStreaming} style={buttonStyle(isStreaming)}>
          {isStreaming ? 'Streaming...' : 'Start streaming test'}
        </button>
        {streamedText && (
          <div style={{ ...infoBoxStyle, color: colors.greenLight, minHeight: 40 }}>
            {streamedText}
            {isStreaming && (
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 16,
                  background: colors.greenLight,
                  marginLeft: 2,
                  animation: 'blink 0.8s infinite',
                }}
              />
            )}
          </div>
        )}
        {!isStreaming && tokenCount > 0 && (
          <p style={{ fontSize: 12, color: colors.textFaint, marginTop: 8 }}>
            Received {tokenCount} tokens
          </p>
        )}
      </div>
    </div>
  )
}
