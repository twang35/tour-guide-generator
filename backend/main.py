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
        # Get API key from environment
        gemini_api_key = os.getenv("GOOGLE_API_KEY")
        if not gemini_api_key:
            raise HTTPException(status_code=500, detail="API key not configured")

        gemini_client = genai.Client(api_key=gemini_api_key)

        # Format the location into the prompt
        prompt = f"""
        Act as an expert historian and engaging storyteller talking through a 3500 word audio tour of {location.location}. 
        The target audience is someone who is standing in front of {location.location}.

        The tour should be Informative, captivating, evocative, historical, and engaging.

        Also make sure to add quirky fun facts and interesting details. 
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
