# Optional feedback audio (#57)

Run from the repository directory with the usual private `.env` configured:

```sh
docker compose -f compose.yaml -f compose.voice.yaml up -d --build
```

The optional override enables a local CPU speech service. First build downloads
Python dependencies and the English voice model, so internet access and extra
build time are required. No OpenAI key or installed browser voice is required.
Piper generates WAV audio locally; the browser uses its native audio controls.
Keep using both Compose files when managing this optional stack.

Sign in and open `/study/audio-preview`. This labeled authored example includes
pinned source links and does not write learning evidence. Listen, pause/resume,
stop, restart, and navigate away. Then stop the speech service and verify that
text and sources still work:

```sh
docker compose -f compose.yaml -f compose.voice.yaml stop speech
```

Already-generated audio may still play from memory. Refresh or use another
feedback item to exercise failure. Start the service again with `up -d speech`
using both Compose files. Default Compose startup keeps the text tutor independent
of speech. Without the override, the audio endpoint returns a useful unavailable
message.

In a real study session the controls appear only for displayed feedback. The
server accepts a session/intervention ID, checks student ownership, and reads
the exact saved text; it never accepts arbitrary client text or grades answers.
Generation is capped at 4,000 characters, one request at a time per app process,
a 45-second app timeout, and four in-memory cached clips. No audio files are
persisted. Playback is not recorded as attention, comprehension, or another answer.
No new assistance event is added because the feedback was already displayed.
Stopping a browser request does not guarantee cancellation of synthesis already
running in the local engine. The speech container is internal, not host-published.

## Engine and voice attribution

- [Piper 1.3.0](https://github.com/OHF-Voice/piper1-gpl/tree/v1.3.0),
  GPL-3.0-or-later; installed as a separate optional service. Preserve its license
  and source obligations when distributing that image.
- [en_US-ljspeech-medium model card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ljspeech/medium/MODEL_CARD).
  The voice repository is MIT-licensed and its model card identifies the LJ Speech
  dataset as public domain. Model and configuration are downloaded by Piper's
  downloader during the image build.

The preview validates playback independently of evaluation. A full live tutoring
session with a cited explanation and successful text-only continuation must still
be verified before claiming integrated completion of #57.

## Recorded checks (October 22, 2026)

- TypeScript, focused ESLint, Prettier, and the Docker production build passed.
- The focused provider test passed: missing configuration and oversized text are
  rejected, malformed audio is not cached, and successful audio is reused.
- Actual Piper generation on Linux ARM64 returned a 330,796-byte WAV at 22,050 Hz
  with 7.5 seconds of audio for a short fictional explanation.
- In the signed-in browser preview, playback state changed to Playing, Paused,
  Playing on resume, and Stopped. This verifies browser state, not human listening
  quality. Text and pinned source links stayed visible.
- Stopping speech and restarting the app to clear its cache produced the useful
  audio-unavailable message; text and sources remained visible. Speech was then
  restarted. No live evaluation was made and no student evidence was fabricated.
