import os
from pywhispercpp.model import Model


model_path = "....."
audio_path = "....."

# Check if files exist
if not os.path.isfile(model_path):
    raise FileNotFoundError(f"Model file not found at {model_path}")
if not os.path.isfile(audio_path):
    raise FileNotFoundError(f"Audio file not found at {audio_path}")

# Initialize the model
model = Model(model_path)

result = model.transcribe(audio_path, language="en")

print(result["text"])
