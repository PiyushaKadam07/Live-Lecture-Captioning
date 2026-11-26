"""Measure how accurate the captions are on real recorded talks.

Uses the TED-LIUM test talks (real speakers, with human-written transcripts)
and reports word error rate (WER) for each Whisper model in two ways:

  whole file   Whisper sees the entire talk at once (the best it can do)
  live chunks  the audio is cut into 3-8 second chunks at pauses, exactly like
               the web app does, and each chunk is sent with the previous text
               as a prompt (what students actually see)

Example:
  pip install -r requirements.txt -r requirements-eval.txt
  python evaluate_wer.py --models tiny.en base.en --talks 4
"""
import argparse
import io
import json
import re
import time

import jiwer
import numpy as np
from datasets import Audio, load_dataset
import av
from faster_whisper import WhisperModel
from whisper_normalizer.english import EnglishTextNormalizer

RATE = 16000
normalize = EnglishTextNormalizer()


def clean(text: str) -> str:
    """Put reference and caption text in the same form before comparing,
    so "It's 25%" and "it is twenty five percent" count as the same words."""
    text = re.sub(r" '(\w)", r"'\1", text)  # TED-LIUM writes "it 's"
    return normalize(text)


def live_chunks(samples: np.ndarray, min_s=3.0, max_s=8.0, silence=0.01):
    """Same rule as the Chunker in src/recognizers/audio.ts: cut at the first
    quiet 100 ms frame after min_s, always cut by max_s, skip silent chunks."""
    frame = RATE // 10
    start, loudest = 0, 0.0
    for end in range(frame, len(samples) + 1, frame):
        level = float(np.sqrt(np.mean(samples[end - frame:end] ** 2)))
        loudest = max(loudest, level)
        seconds = (end - start) / RATE
        if (seconds >= min_s and level < silence) or seconds >= max_s:
            if loudest >= silence:
                yield samples[start:end]
            start, loudest = end, 0.0
    if start < len(samples) and loudest >= silence:
        yield samples[start:]


def transcribe_whole(model, samples):
    segments, _ = model.transcribe(samples, language="en", beam_size=1, vad_filter=True)
    return " ".join(s.text.strip() for s in segments)


def transcribe_live(model, samples):
    """Mirrors the app + server: one request per chunk, last 200 characters as the prompt."""
    previous = ""
    for chunk in live_chunks(samples):
        segments, _ = model.transcribe(
            chunk, language="en", beam_size=1, vad_filter=True,
            initial_prompt=previous[-200:].strip() or None,
        )
        text = " ".join(s.text.strip() for s in segments).strip()
        if text:
            previous += " " + text
    return previous.strip()

def decode(data: bytes) -> np.ndarray:
    """Decode an audio file (any format) to 16 kHz mono floats, the way Whisper wants it."""
    pieces = []
    with av.open(io.BytesIO(data)) as container:
        resampler = av.AudioResampler(format="s16", layout="mono", rate=RATE)
        for frame in container.decode(audio=0):
            pieces += [f.to_ndarray() for f in resampler.resample(frame)]
        pieces += [f.to_ndarray() for f in resampler.resample(None)]  # flush the last bit
    return np.concatenate(pieces, axis=1).reshape(-1).astype(np.float32) / 32768.0

def load_talks(count: int):
    ds = load_dataset("distil-whisper/tedlium-long-form", split="test")
    ds = ds.cast_column("audio", Audio(decode=False))  # decode ourselves, no PyTorch needed
    text_column = next(c for c in ("text", "transcript", "sentence") if c in ds.column_names)
    talks = []
    for row in ds.select(range(min(count, len(ds)))):
        audio = decode(row["audio"]["bytes"])        
        talks.append((audio, row[text_column]))
    return talks


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--models", nargs="+", default=["tiny.en", "base.en"])
    parser.add_argument("--talks", type=int, default=4, help="how many TED talks to use")
    parser.add_argument("--out", default="wer_results.json")
    args = parser.parse_args()

    talks = load_talks(args.talks)
    hours = sum(len(a) for a, _ in talks) / RATE / 3600
    print(f"{len(talks)} talks, {hours:.2f} hours of audio\n")
    references = [clean(ref) for _, ref in talks]

    results = []
    for name in args.models:
        model = WhisperModel(name, device="cpu", compute_type="int8")
        for mode, run in (("whole file", transcribe_whole), ("live chunks", transcribe_live)):
            start = time.perf_counter()
            captions = [clean(run(model, audio)) for audio, _ in talks]
            seconds = time.perf_counter() - start
            row = {
                "model": name,
                "mode": mode,
                "wer": round(jiwer.wer(references, captions) * 100, 1),
                "speed": round(hours * 3600 / seconds, 1),  # x faster than real time
            }
            results.append(row)
            print(f"{name:9} {mode:12} WER {row['wer']:5.1f}%   {row['speed']:5.1f}x real time", flush=True)

    with open(args.out, "w") as f:
        json.dump({"talks": len(talks), "hours": round(hours, 2), "results": results}, f, indent=2)
    print(f"\nSaved to {args.out}")


if __name__ == "__main__":
    main()