#!/usr/bin/env bash
set -e
# Check if the build directory exists
if [ ! -d "build" ]; then
    echo "Build directory does not exist. Please run run_build.sh first."
    exit 1
fi

# add the paths to the environment variables
AUDIO=${1:-tests/voice/Valeria_Test_1.en.wav}
WHISPER_MODEL=${2:-models/ggml-medium-q8_0.bin}
LLAMA_MODEL=${3:-models/llama-3.2-3b-instruct.f16.gguf}

# Check if the required files exist 
if [ ! -f "$AUDIO" ]; then
    echo "Test audio file does not exist. Please check the path."
    exit 1
fi
if [ ! -f "$WHISPER_MODEL" ]; then
    echo "Model file for whisper does not exist. Please check the path."
    exit 1
fi
if [ ! -f "$LLAMA_MODEL" ]; then
    echo "Model file for llama does not exist. Please check the path."
    exit 1
fi
# Run the integration test
./build/TestIntegration tests/voice/Valeria_Test_1.en.wav models/ggml-medium-q8_0.bin models/llama-3.2-3b-instruct.f16.gguf