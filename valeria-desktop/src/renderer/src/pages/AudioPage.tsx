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
