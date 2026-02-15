# Tour Guide Generator

http://tours.tony-wang.com/

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

## Kokoro TTS Setup

Download the following model files into the `backend/` directory:

- `kokoro-v1.0.onnx` — https://github.com/thewh1teagle/kokoro-onnx/releases
- `voices-v1.0.bin` — https://github.com/thewh1teagle/kokoro-onnx/releases

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

## Setting up GCP servers

Also be sure to set up firewall rules for ingress at 0.0.0.0/0 on tcp:3000, 8000
and egress at 0.0.0.0/0 on tcp:443

```bash
### git

which git
sudo apt install git

git clone https://github.com/twang35/tour-guide-generator.git

### npm 
npm -v
node -v

sudo apt-get install -y nodejs
sudo apt-get install -y npm

npm install

nohup npm start > /tmp/npm.log 2>&1 &
disown

### Google API key
# Get key from https://console.cloud.google.com/apis/credentials/key/f14d623f-5f93-4a61-a863-a0b4b208527f?project=gen-lang-client-0306919185
echo 'export GOOGLE_API_KEY="your_api_key_here"' >> ~/.bashrc

### pip and uvicorn
conda install pip

pip3 --version

cd backend
pip install -r requirements.txt
nohup uvicorn main:app --reload --host 0.0.0.0 --port 8000 > /tmp/uvicorn.log 2>&1 &
disown

# to view processes
ps -ef
```