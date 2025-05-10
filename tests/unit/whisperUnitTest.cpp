// Minimal unit test for the Whisper transcription function.
// Uses assert to verify that a known WAV file produces non-empty output.

#include <cassert>
#include <iostream>
#include <vector>
#include <string>
#include <whisper.h>
#include "../integration/TestIntegration.cpp"  // include the transcription function

int main() {
    const char* model_path = "models/ggml-medium-q8_0.bin";
    const char* audio_path = "tests/sample_speech.wav";  // 16kHz PCM16 WAV

    // Initialize Whisper context with default params (CPU)
    whisper_context_params params = whisper_context_default_params();
    params.use_gpu = false;
    whisper_context* ctx = whisper_init_from_file_with_params_no_state(model_path, params);
    assert(ctx && "Failed to initialize Whisper model");

    // Load audio and transcribe
    std::vector<float> audio = load_audio(audio_path);
    assert(!audio.empty() && "Failed to load audio data");

    std::string transcript = transcribe(ctx, audio);
    whisper_free(ctx);

    std::cerr << "Transcript: '" << transcript << "'\n";
    assert(!transcript.empty() && "Transcript should not be empty for sample speech");

    std::cout << "whisperUnitTest passed." << std::endl;
    return 0;
}