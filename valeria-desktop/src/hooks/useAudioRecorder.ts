import { useState, useRef, useCallback } from 'react';

/**
 * WHAT THIS HOOK DOES:
 * 
 * Captures audio from the microphone using the Web Audio API,
 * resamples it to 16kHz mono (what Whisper needs), and returns
 * the samples as a Float32Array.
 * 
 * WHY A CUSTOM HOOK:
 * Audio recording involves multiple pieces of state (recording flag,
 * error messages) and browser APIs (MediaStream, AudioContext) that
 * need careful setup and cleanup. Wrapping it in a hook keeps the
 * component clean and makes the recording logic reusable.
 * 
 * HOW WEB AUDIO RECORDING WORKS:
 * 
 * 1. navigator.mediaDevices.getUserMedia() — asks the user for
 *    microphone permission and returns a MediaStream
 * 
 * 2. MediaRecorder — records the stream into compressed audio chunks
 *    (typically webm/opus format)
 * 
 * 3. AudioContext.decodeAudioData() — decodes the compressed chunks
 *    back into raw PCM samples
 * 
 * 4. OfflineAudioContext — resamples from the native rate (44.1/48kHz)
 *    down to 16kHz mono
 * 
 * Steps 3-4 are the tricky part. The browser records in a compressed
 * format, so we need to decode it and then resample it. This is all
 * done in-browser with no external libraries.
 */

interface UseAudioRecorderReturn {
  /** Whether the microphone is currently recording */
  isRecording: boolean;
  /** Any error message from recording or processing */
  error: string | null;
  /** Start recording from the microphone */
  startRecording: () => Promise<void>;
  /** Stop recording and return resampled 16kHz mono samples */
  stopRecording: () => Promise<Float32Array | null>;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * useRef stores a value that persists across renders WITHOUT
   * triggering a re-render when it changes. Perfect for storing
   * the MediaRecorder and stream — we need them to persist between
   * startRecording() and stopRecording(), but we don't need React
   * to re-render when they change.
   * 
   * Think of useRef as a box you can put things in. The box persists
   * across renders, and opening/closing it doesn't trigger a re-render.
   * useState is for data the UI displays. useRef is for data the UI
   * doesn't display but the logic needs.
   */
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      /**
       * getUserMedia() triggers the browser's permission dialog.
       * On Linux/Electron, this asks the OS for microphone access.
       * The returned MediaStream is a live connection to the mic.
       */
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Request specific audio settings
          channelCount: 1,        // Mono (reduces processing)
          sampleRate: 16000,      // Request 16kHz (browser may ignore this)
          echoCancellation: true,  // Reduce echo from speakers
          noiseSuppression: true,  // Reduce background noise
        },
      });

      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      /**
       * MediaRecorder captures the stream into compressed chunks.
       * We collect these chunks in an array and combine them when
       * recording stops.
       */
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(message);
      console.error('Recording error:', err);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Float32Array | null> => {
    const mediaRecorder = mediaRecorderRef.current;
    const stream = mediaStreamRef.current;

    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      return null;
    }

    /**
     * Stopping the MediaRecorder is async — we need to wait for
     * the final 'dataavailable' event before the chunks are complete.
     * We wrap this in a Promise so we can await it.
     */
    const audioBlob = await new Promise<Blob>((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        resolve(blob);
      };
      mediaRecorder.stop();
    });

    // Stop all mic tracks (releases the microphone)
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    setIsRecording(false);
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;

    // Now convert the compressed audio to 16kHz mono Float32Array
    try {
      const resampled = await resampleAudio(audioBlob);
      return resampled;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process audio';
      setError(message);
      return null;
    }
  }, []);

  return { isRecording, error, startRecording, stopRecording };
}

/**
 * Convert compressed audio (webm/opus) to 16kHz mono Float32Array.
 * 
 * This is the resampling pipeline:
 * 
 * 1. Read the Blob as an ArrayBuffer (raw bytes)
 * 2. Decode with AudioContext → gives us an AudioBuffer at the
 *    browser's native sample rate (44.1kHz or 48kHz)
 * 3. Create an OfflineAudioContext at 16kHz
 * 4. Copy the decoded audio into the offline context
 * 5. Render — the offline context automatically resamples
 * 6. Extract the mono channel as Float32Array
 * 
 * OfflineAudioContext is the key tool here. It's like a regular
 * AudioContext but instead of playing audio through speakers, it
 * renders to a buffer as fast as the CPU allows. By creating one
 * at 16kHz, anything we play through it gets resampled to 16kHz.
 */
async function resampleAudio(audioBlob: Blob): Promise<Float32Array> {
  // Step 1: Read the compressed audio as raw bytes
  const arrayBuffer = await audioBlob.arrayBuffer();

  // Step 2: Decode to raw PCM at the browser's native sample rate
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();

  // Step 3-5: Resample to 16kHz mono
  const targetSampleRate = 16000;
  const numChannels = 1; // Mono

  // Calculate the duration and number of output samples
  const duration = audioBuffer.duration;
  const outputLength = Math.ceil(duration * targetSampleRate);

  // Create an offline context at our target sample rate
  const offlineContext = new OfflineAudioContext(
    numChannels,
    outputLength,
    targetSampleRate
  );

  // Create a source from the decoded audio and connect it
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  // Render — this resamples the audio to 16kHz
  const resampledBuffer = await offlineContext.startRendering();

  // Step 6: Extract the mono channel
  const samples = resampledBuffer.getChannelData(0);

  // Return a COPY (getChannelData returns a view into the buffer,
  // which might get garbage collected)
  return new Float32Array(samples);
}