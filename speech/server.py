"""Internal, single-worker Piper adapter. No text or generated audio is logged/saved."""

import io
import json
import wave
from http.server import BaseHTTPRequestHandler, HTTPServer
from piper import PiperVoice

voice = PiperVoice.load("en_US-ljspeech-medium.onnx")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        self.send_response(200 if self.path == "/health" else 404)
        self.end_headers()

    def do_POST(self):
        if self.path != "/synthesize":
            self.send_error(404)
            return
        self.connection.settimeout(10)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 20000:
                self.send_error(413)
                return
            text = json.loads(self.rfile.read(length))["text"]
            if not isinstance(text, str) or not 0 < len(text) <= 4000:
                self.send_error(400)
                return
            output = io.BytesIO()
            with wave.open(output, "wb") as wav:
                voice.synthesize_wav(text, wav)
            audio = output.getvalue()
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(audio)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(audio)
        except (KeyError, ValueError, TypeError):
            self.send_error(400)
        except Exception:
            self.send_error(503)


HTTPServer(("0.0.0.0", 5000), Handler).serve_forever()
