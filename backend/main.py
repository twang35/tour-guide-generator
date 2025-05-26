from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
from typing import Optional
from pydantic import BaseModel
from dotenv import load_dotenv
import os
from google import genai


# Load environment variables
load_dotenv()

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Allow requests from our React app
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
        Act as an expert historian and engaging storyteller creating the text for a 5-minute audio tour of {location.location}. 
        The target audience is someone who is standing in front of {location.location}.

        The tour should be awe-inspiring, informative, and captivating, making the listener feel as if they
        are walking through {location.location}.

        Also make sure to add fun facts and interesting details about {location.location}.
        """.format(location=location.location)
        
        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )

        print(prompt)

        # Here we would integrate with an AI model to generate tour guide text
        # For now, we'll use a simple template
        tour_guide_text = f"Welcome to {location.location}!\n\n"
        tour_guide_text += response.text
        tour_guide_text += "FOO done"
        
        return {"tour_guide_text": tour_guide_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
