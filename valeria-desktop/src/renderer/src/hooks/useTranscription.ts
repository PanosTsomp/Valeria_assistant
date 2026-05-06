import { useState, useCallback } from 'react'
import { useAudioRecorder } from './useAudioRecorder'

interface UseTranscriptionReturn {
  isRecording: boolean
  recordError: string | null
  audioStatus: string
  savedFilePath: string
  isPlaying: boolean
  transcript: string
  isTranscribing: boolean
  transcribeTime: number
  handleToggleRecording: () => Promise<void>
  handlePlayback: () => Promise<void>
}

export function useTranscription(): UseTranscriptionReturn {
  const { isRecording, error: recordError, startRecording, stopRecording } = useAudioRecorder()
  const [audioStatus, setAudioStatus] = useState('')
  const [savedFilePath, setSavedFilePath] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcribeTime, setTranscribeTime] = useState(0)

  const handleToggleRecording = useCallback(async () => {
    if (!window.electronAPI) return
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
      const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength)

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

  return {
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
  }
}
