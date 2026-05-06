import { Component, type ReactNode } from 'react'
import { MemoryRouter, Routes, Route, NavLink } from 'react-router-dom'
import ChatPage from './pages/ChatPage'
import AudioPage from './pages/AudioPage'
import DevPage from './pages/DevPage'
import { colors } from './styles/theme'

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            color: '#ef5350',
            fontFamily: 'monospace',
            fontSize: 13,
            background: '#1a1a2e',
            minHeight: '100vh',
          }}
        >
          <strong style={{ fontSize: 16 }}>Render error</strong>
          <pre style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
          <pre style={{ marginTop: 8, color: '#888', whiteSpace: 'pre-wrap' }}>
            {this.state.error.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  padding: '6px 16px',
  borderRadius: 6,
  background: isActive ? colors.purple : 'transparent',
  color: isActive ? colors.white : colors.textMuted,
  fontSize: 14,
  fontWeight: 500,
  textDecoration: 'none',
})

function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
    <MemoryRouter>
      <div
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          maxWidth: 460,
          margin: '0 auto',
          padding: 24,
          color: colors.text,
          minHeight: '100vh',
          background: colors.appBg,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 16, color: colors.white }}>
          Valeria
        </h1>

        <nav style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
          <NavLink to="/" end style={navLinkStyle}>
            Chat
          </NavLink>
          <NavLink to="/audio" style={navLinkStyle}>
            Audio
          </NavLink>
          {import.meta.env.DEV && (
            <NavLink to="/dev" style={navLinkStyle}>
              Dev
            </NavLink>
          )}
        </nav>

        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/audio" element={<AudioPage />} />
          <Route path="/dev" element={<DevPage />} />
        </Routes>

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
    </MemoryRouter>
    </ErrorBoundary>
  )
}

export default App
