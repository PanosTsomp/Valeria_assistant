import { useState } from 'react';
import { useTranscription } from '../hooks/useTranscription'
import { useTTS } from '../hooks/useTTS';
import { sectionStyle, headingStyle, buttonStyle, infoBoxStyle, colors } from '../styles/theme'

export default function AudioPage(): React.JSX.Element {
  const {
    isRecording,
    recordError,
    audioStatus,
    savedFilePath,
    isPlaying,
    transcript,
    isTranscribing,
    transcribeTime,
    handleToggleRecording,
    handlePlayback,
  } = useTranscription()

  const { speak, stop, isSpeaking, ttsError } = useTTS();
  const [ttsInput, setTtsInput] = useState('');

  return (
    <div style={sectionStyle}>
      <h2 style={headingStyle}>Microphone recording</h2>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={handleToggleRecording}
          style={{
            ...buttonStyle(false, isRecording ? colors.red : colors.purple),
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {isRecording && (
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#ff4444',
                animation: 'pulse 1s infinite',
              }}
            />
          )}
          {isRecording ? 'Stop recording' : 'Start recording'}
        </button>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Text-to-Speech test</h2>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={ttsInput}
              onChange={(e) => setTtsInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSpeaking) speak(ttsInput);
              }}
              placeholder="Type something for Valeria to say..."
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 8,
                border: `1px solid ${colors.border}`, background: colors.inputBg,
                color: colors.text, fontSize: 14, outline: 'none',
              }}
            />
            <button
              onClick={() => isSpeaking ? stop() : speak(ttsInput)}
              style={buttonStyle(false, isSpeaking ? colors.red : colors.purple)}
            >
              {isSpeaking ? 'Stop' : 'Speak'}
            </button>
          </div>

          {ttsError && (
            <div style={{ ...infoBoxStyle, color: '#ef5350' }}>
              TTS Error: {ttsError}
            </div>
          )}
        </div>

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
        <div style={{ ...infoBoxStyle, color: colors.redError }}>Error: {recordError}</div>
      )}
      {audioStatus && (
        <div style={{ ...infoBoxStyle, color: colors.blueStatus }}>{audioStatus}</div>
      )}
      {isTranscribing && (
        <div style={{ ...infoBoxStyle, color: colors.warning }}>Transcribing with Whisper...</div>
      )}

      {transcript && (
        <div
          style={{
            marginTop: 12,
            padding: '14px 16px',
            background: colors.assistantMsgBg,
            borderRadius: 8,
            borderLeft: `3px solid ${colors.green}`,
          }}
        >
          <div style={{ fontSize: 12, color: colors.green, marginBottom: 6, fontWeight: 500 }}>
            TRANSCRIPT ({transcribeTime}ms)
          </div>
          <div style={{ fontSize: 15, color: colors.greenText, lineHeight: 1.6 }}>{transcript}</div>
        </div>
      )}
    </div>
  )
}
