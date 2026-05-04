import { useChat } from '../hooks/useChat'
import { sectionStyle, headingStyle, buttonStyle, inputStyle, colors } from '../styles/theme'

export default function ChatPage(): React.JSX.Element {
  const { chatInput, setChatInput, chatMessages, currentResponse, isChatting, handleChatSend } =
    useChat()

  return (
    <div style={sectionStyle}>
      <h2 style={headingStyle}>Chat with Valeria</h2>

      <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
        {chatMessages.map((msg, i) => (
          <div
            key={i}
            style={{
              padding: '10px 14px',
              marginBottom: 8,
              borderRadius: 8,
              background: msg.role === 'user' ? colors.inputBg : colors.assistantMsgBg,
              borderLeft: `3px solid ${msg.role === 'user' ? colors.blue : colors.green}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: msg.role === 'user' ? colors.blue : colors.green,
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
              {msg.role === 'user' ? 'YOU' : 'VALERIA'}
            </div>
            <div style={{ fontSize: 14, color: colors.text, lineHeight: 1.6 }}>{msg.content}</div>
          </div>
        ))}

        {currentResponse && (
          <div
            style={{
              padding: '10px 14px',
              marginBottom: 8,
              borderRadius: 8,
              background: colors.assistantMsgBg,
              borderLeft: `3px solid ${colors.green}`,
            }}
          >
            <div style={{ fontSize: 11, color: colors.green, marginBottom: 4, fontWeight: 500 }}>
              VALERIA
            </div>
            <div style={{ fontSize: 14, color: colors.text, lineHeight: 1.6 }}>
              {currentResponse}
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 16,
                  background: colors.green,
                  marginLeft: 2,
                  animation: 'blink 0.8s infinite',
                }}
              />
            </div>
          </div>
        )}
      </div>

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
          style={{ ...inputStyle, opacity: isChatting ? 0.6 : 1 }}
        />
        <button onClick={handleChatSend} disabled={isChatting} style={buttonStyle(isChatting)}>
          {isChatting ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
