# Tour Guide Generator

A modern web application that generates tour guide text based on location input.

## Launch servers

1. Start the backend server:
```bash
cd backend
conda activate audio-tour
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

2. In a new terminal, start the frontend development server:
```bash
cd tour-guide-generator
npm start
```

The application will open automatically in your default browser at http://localhost:3000.

## Features

- Enter any location to generate tour guide text
- Clean, modern UI with responsive design
- Real-time tour guide text generation
- Loading states and error handling

## Tech Stack

- Frontend: React
- Backend: FastAPI
- Styling: CSS3
- Development: create-react-app