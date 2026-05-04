import { useState, useEffect, useCallback } from 'react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface UseChatReturn {
  chatInput: string
  setChatInput: (value: string) => void
  chatMessages: ChatMessage[]
  currentResponse: string
  isChatting: boolean
  handleChatSend: () => Promise<void>
}

export function useChat(): UseChatReturn {
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [currentResponse, setCurrentResponse] = useState('')
  const [isChatting, setIsChatting] = useState(false)

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
    const cleanupComplete = window.electronAPI.onChatComplete(() => {})
    return () => {
      cleanupToken()
      cleanupComplete()
    }
  }, [])

  return { chatInput, setChatInput, chatMessages, currentResponse, isChatting, handleChatSend }
}
