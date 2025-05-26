from fastapi import FastAPI, HTTPException
import requests
from typing import Optional
from pydantic import BaseModel

app = FastAPI()

class Location(BaseModel):
    location: str

@app.post("/generate-tour-guide")
async def generate_tour_guide(location: Location):
    try:
        # Here we would integrate with an AI model to generate tour guide text
        # For now, we'll use a simple template
        tour_guide_text = f"Welcome to {location.location}!\n\n"
        tour_guide_text += "This location is renowned for its [insert interesting facts here].\n"
        tour_guide_text += "Key highlights include:\n"
        tour_guide_text += "- [Highlight 1]\n"
        tour_guide_text += "- [Highlight 2]\n"
        tour_guide_text += "- [Highlight 3]\n\n"
        tour_guide_text += "Don't forget to visit [recommended attraction]!"
        
        return {"tour_guide_text": tour_guide_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
