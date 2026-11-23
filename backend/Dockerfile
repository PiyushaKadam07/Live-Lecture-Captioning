FROM python:3.12-slim

WORKDIR /app

# Install the libraries first. Docker caches this step, so editing main.py
# later doesn't reinstall everything.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download the Whisper model while building the image, so the server
# doesn't have to download it every time it starts on Cloud Run.
ARG WHISPER_MODEL=base.en
ENV WHISPER_MODEL=${WHISPER_MODEL}
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('${WHISPER_MODEL}', device='cpu', compute_type='int8')"

COPY main.py .

# Cloud Run tells the server which port to use through $PORT
ENV PORT=8080
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]