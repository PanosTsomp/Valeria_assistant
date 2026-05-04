import type { CSSProperties } from 'react'

export const colors = {
  appBg: '#1a1a2e',
  sectionBg: '#16213e',
  inputBg: '#0f3460',
  darkBg: '#0a1628',
  assistantMsgBg: '#1a2e1a',
  text: '#e0e0e0',
  textMuted: '#888',
  textFaint: '#666',
  textHeading: '#ccc',
  white: '#ffffff',
  blue: '#42a5f5',
  blueStatus: '#90caf9',
  green: '#4caf50',
  greenLight: '#a5d6a7',
  greenText: '#c8e6c9',
  red: '#dc2626',
  redError: '#ef5350',
  warning: '#ffd54f',
  purple: '#533483',
  border: '#2a2a4a',
}

export const sectionStyle: CSSProperties = {
  background: colors.sectionBg,
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
}

export const headingStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 500,
  marginBottom: 12,
  color: colors.textHeading,
}

export const infoBoxStyle: CSSProperties = {
  marginTop: 12,
  padding: '10px 14px',
  background: colors.darkBg,
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'monospace',
  lineHeight: 1.6,
}

export const inputStyle: CSSProperties = {
  flex: 1,
  padding: '10px 14px',
  borderRadius: 8,
  border: `1px solid ${colors.border}`,
  background: colors.inputBg,
  color: colors.text,
  fontSize: 14,
  outline: 'none',
}

export const buttonStyle = (active: boolean, color: string = colors.purple): CSSProperties => ({
  padding: '10px 20px',
  borderRadius: 8,
  border: 'none',
  background: active ? colors.border : color,
  color: active ? colors.textFaint : colors.white,
  fontSize: 14,
  cursor: active ? 'not-allowed' : 'pointer',
  fontWeight: 500,
  marginRight: 8,
})
