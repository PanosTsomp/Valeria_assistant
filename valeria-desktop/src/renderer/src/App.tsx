import { MemoryRouter, Routes, Route, NavLink } from 'react-router-dom'
import ChatPage from './pages/ChatPage'
import AudioPage from './pages/AudioPage'
import DevPage from './pages/DevPage'
import { colors } from './styles/theme'

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
  )
}

export default App
