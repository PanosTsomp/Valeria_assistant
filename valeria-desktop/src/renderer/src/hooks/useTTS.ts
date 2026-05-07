// src/renderer/src/hooks/useTTS.ts

import { useState, useCallback, useRef } from 'react';

/**
 * Hook for text-to-speech synthesis and playback.
 * 
 * Sends text to the main process for Kokoro TTS synthesis,
 * receives audio samples back, and plays them through the
 * Web Audio API.
 */
export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  /**
   * Synthesize text and play it through the speakers.
   */
  const speak = useCallback(async (text: string) => {
    if (!window.electronAPI || text.trim() === '') return;

    try {
      setIsSpeaking(true);
      setTtsError(null);

      // Send text to main process for TTS synthesis
      const result = await window.electronAPI.ttsSynthesize(text);

      if (result.error || !result.samples) {
        setTtsError(result.error || 'No audio generated');
        setIsSpeaking(false);
        return;
      }

      // Convert the samples back to Float32Array
      const float32 = new Float32Array(result.samples);

      // Create an AudioContext at the correct sample rate
      const audioContext = new AudioContext({ sampleRate: result.sampleRate });
      audioContextRef.current = audioContext;

      // Create an AudioBuffer and fill it with our samples
      const audioBuffer = audioContext.createBuffer(
        1,                   // mono
        float32.length,      // number of samples
        result.sampleRate    // sample rate (24000 for Kokoro)
      );
      audioBuffer.getChannelData(0).set(float32);

      // Create a source node and play
      const source = audioContext.createBufferSource();
      sourceRef.current = source;
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      source.onended = () => {
        setIsSpeaking(false);
        audioContext.close();
        audioContextRef.current = null;
        sourceRef.current = null;
      };

      source.start(0);
    } catch (err) {
      console.error('TTS playback error:', err);
      setTtsError(err instanceof Error ? err.message : 'Playback failed');
      setIsSpeaking(false);
    }
  }, []);

  /**
   * Stop any currently playing audio.
   */
  const stop = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, ttsError };
}