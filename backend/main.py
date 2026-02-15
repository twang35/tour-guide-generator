from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import requests
from typing import Optional
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import io
from google import genai
import re
import time


# Load environment variables
load_dotenv()

app = FastAPI()

# Lazy-loaded Kokoro model
_kokoro_instance = None

def get_kokoro():
    global _kokoro_instance
    if _kokoro_instance is None:
        from kokoro_onnx import Kokoro
        model_path = os.path.join(os.path.dirname(__file__), "kokoro-v1.0.onnx")
        voices_path = os.path.join(os.path.dirname(__file__), "voices-v1.0.bin")
        _kokoro_instance = Kokoro(model_path, voices_path)
    return _kokoro_instance

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow requests from any origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Location(BaseModel):
    location: str

class TTSRequest(BaseModel):
    text: str
    voice: str = "am_liam"
    speed: float = 1.0

KOKORO_VOICES = [
    {"id": "af_heart", "name": "Heart (Female)"},
    {"id": "af_alloy", "name": "Alloy (Female)"},
    {"id": "af_aoede", "name": "Aoede (Female)"},
    {"id": "af_bella", "name": "Bella (Female)"},
    {"id": "af_jessica", "name": "Jessica (Female)"},
    {"id": "af_kore", "name": "Kore (Female)"},
    {"id": "af_nicole", "name": "Nicole (Female)"},
    {"id": "af_nova", "name": "Nova (Female)"},
    {"id": "af_river", "name": "River (Female)"},
    {"id": "af_sarah", "name": "Sarah (Female)"},
    {"id": "af_sky", "name": "Sky (Female)"},
    {"id": "am_adam", "name": "Adam (Male)"},
    {"id": "am_echo", "name": "Echo (Male)"},
    {"id": "am_eric", "name": "Eric (Male)"},
    {"id": "am_liam", "name": "Liam (Male)"},
    {"id": "am_michael", "name": "Michael (Male)"},
    {"id": "am_onyx", "name": "Onyx (Male)"},
    {"id": "am_puck", "name": "Puck (Male)"},
    {"id": "am_santa", "name": "Santa (Male)"},
]

@app.post("/generate-tour-guide")
async def generate_tour_guide(location: Location):
    try:
        # Log the location request to /tmp/locations.txt
        import datetime
        timestamp = datetime.datetime.now().isoformat()
        log_entry = f"{timestamp}: {location.location}\n"
        
        try:
            with open("/tmp/locations.txt", "a") as log_file:
                log_file.write(log_entry)
        except Exception as log_error:
            print(f"Failed to write to log file: {log_error}")
        
        print("Generating tour guide for:", location.location)
        
        # Get API key from environment
        gemini_api_key = os.getenv("GOOGLE_API_KEY")
        if not gemini_api_key:
            raise HTTPException(status_code=500, detail="API key not configured")

        gemini_client = genai.Client(api_key=gemini_api_key)

        # Format the location into the prompt
        prompt = f"""
        Act as an expert historian and engaging storyteller giving a 3500-word audio tour of {location.location}.
        The listener is standing in front of {location.location}.

        The tour should:
         * Be highly detailed, factual, and historically accurate, focusing on specific events, dates, people, and architectural or cultural significance.
         * Maintain an engaging and vivid narrative style, but avoid overly poetic or fluffy language.
         * Include quirky, surprising, or little-known facts that make the site memorable.
         * Connect the site to its broader historical, social, or cultural context.
         * Use clear, descriptive language to help the listener visualize features of the site without exaggeration.
         * Avoid stage directions, parenthetical asides, and emphasis markers (like asterisks).

        The result should feel like a knowledgeable, passionate historian guiding a curious visitor — rich with facts and insights rather than filler.
        
        Do not use stage directions or parenthetical asides or asterisks for emphasis.
        """.format(location=location.location)

        print(prompt)
        
        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        
        tour_guide_text = response.text
        
        print(tour_guide_text)

        # Remove stage directions surrounded by () like (Sound of gentle Andean flute)
        # First, handle stage directions that are on their own line (between paragraphs)
        tour_guide_text = re.sub(r'\n\s*\([^)]*\)\s*\n', '\n\n', tour_guide_text)
        # Then handle inline stage directions, replace with a single space
        tour_guide_text = re.sub(r'\s*\([^)]*\)\s*', ' ', tour_guide_text)
        # Remove asterisks
        tour_guide_text = re.sub(r'\*', '', tour_guide_text)
        # Clean up multiple spaces and ensure proper paragraph breaks
        tour_guide_text = re.sub(r'\n\s*\n\s*\n', '\n\n\n', tour_guide_text)
        tour_guide_text = re.sub(r' +', ' ', tour_guide_text)
        tour_guide_text = tour_guide_text.strip()
        
        return {"tour_guide_text": tour_guide_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/kokoro-voices")
async def kokoro_voices():
    return {"voices": KOKORO_VOICES}

@app.post("/tts")
async def text_to_speech(req: TTSRequest):
    try:
        import soundfile as sf
        import numpy as np

        request_start = time.time()

        kokoro = get_kokoro()

        gen_start = time.time()
        samples, sample_rate = kokoro.create(
            req.text, voice=req.voice, speed=req.speed, lang="en-us"
        )
        gen_time = time.time() - gen_start

        wav_start = time.time()
        buf = io.BytesIO()
        sf.write(buf, samples, sample_rate, format="WAV")
        buf.seek(0)
        wav_time = time.time() - wav_start

        total_time = time.time() - request_start
        print(f"[TTS] text_length={len(req.text)} voice={req.voice} "
              f"audio_gen={gen_time:.3f}s wav_encode={wav_time:.3f}s total={total_time:.3f}s")

        return StreamingResponse(buf, media_type="audio/wav")
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Kokoro model files not found. Download kokoro-v1.0.onnx and voices-v1.0.bin into the backend/ directory.",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
