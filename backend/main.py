"""Speech-to-text server for Lecture Captions.

The browser records a few seconds of audio at a time and posts it here.
We run Whisper on it and send the text back.
"""
import io
import os
import time
import wave

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

# base.en is a good balance of speed and accuracy on a CPU.
# Change it without touching the code, e.g. WHISPER_MODEL=small.en
MODEL_SIZE = os.getenv("WHISPER_MODEL", "base.en")

# Only these websites are allowed to call the server from a browser.
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,https://piyushakadam07.github.io",
).split(",")

app = FastAPI(title="Lecture Captions speech server")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Load the model once when the server starts, not on every request.
model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")


def read_wav(data: bytes) -> np.ndarray:
    """Turn a 16 kHz mono 16-bit WAV file into the float array Whisper expects."""
    with wave.open(io.BytesIO(data)) as wav:
        if (wav.getframerate(), wav.getnchannels(), wav.getsampwidth()) != (16000, 1, 2):
            raise ValueError("audio must be 16 kHz, mono, 16-bit WAV")
        frames = wav.readframes(wav.getnframes())
    return np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_SIZE}


@app.post("/transcribe")
def transcribe(audio: UploadFile = File(...), prompt: str = Form("")):
    try:
        samples = read_wav(audio.file.read())
    except (wave.Error, ValueError, EOFError) as err:
        raise HTTPException(400, f"Could not read the audio: {err or 'not a WAV file'}")

    start = time.perf_counter()
    segments, _ = model.transcribe(
        samples,
        language="en",
        beam_size=1,                    # greedy decoding: much faster, nearly as accurate
        vad_filter=True,                # skip silent parts
        initial_prompt=prompt or None,  # the last few words, so sentences carry on smoothly
    )
    text = " ".join(segment.text.strip() for segment in segments)

    return {
        "text": text,
        "audio_seconds": round(len(samples) / 16000, 2),
        "processing_seconds": round(time.perf_counter() - start, 2),
    }