FROM python:3.11-slim-bookworm
WORKDIR /speech
RUN pip install --no-cache-dir piper-tts==1.3.0
RUN python -m piper.download_voices en_US-ljspeech-medium
COPY server.py ./server.py
USER nobody
ENV OMP_NUM_THREADS=2
EXPOSE 5000
CMD ["python", "server.py"]
