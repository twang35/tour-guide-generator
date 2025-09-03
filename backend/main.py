from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
from typing import Optional
from pydantic import BaseModel
from dotenv import load_dotenv
import os
from google import genai
import re


# Load environment variables
load_dotenv()

app = FastAPI()

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
