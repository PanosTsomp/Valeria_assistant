import os
from pywhispercpp.model import Model

# Define paths
model_path = "/media/panos/C/projects/Valeria_assistant/whisper.cpp/models/ggml-large-v3-turbo-q5_0.bin"  # Replace with your actual model path
audio_path = "/media/panos/C/projects/Valeria_assistant/tests/voice/Take1_Voice2_gr-en.wav"                # Replace with your actual audio file path

# Check if files exist
if not os.path.isfile(model_path):
    raise FileNotFoundError(f"Model file not found at {model_path}")
if not os.path.isfile(audio_path):
    raise FileNotFoundError(f"Audio file not found at {audio_path}")

# Initialize the model
model = Model(model_path)

result = model.transcribe(audio_path, language="en")

print(result["text"])
