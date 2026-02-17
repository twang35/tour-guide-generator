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
# Get the gemini API key from https://aistudio.google.com/api-keys
echo 'export GOOGLE_API_KEY="your_api_key_here"' >> ~/.bashrc

### Download Kokoro files
mkdir -p tour-guide-generator/public/kokoro-local/resolve/main && cd "$_"
# Create directories                                                                                                                                                                                                                                                    
mkdir -p onnx voices

# Config files (small)
curl -L -o config.json "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/config.json"
curl -L -o tokenizer.json "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/tokenizer.json"
curl -L -o tokenizer_config.json "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/tokenizer_config.json"

# ONNX models (large — pick the ones you need)
curl -L -o onnx/model.onnx "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx"                     # 326 MB, fp32
curl -L -o onnx/model_fp16.onnx "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_fp16.onnx"           # 163 MB, fp16
curl -L -o onnx/model_quantized.onnx "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_quantized.onnx" # 92 MB, q8
curl -L -o onnx/model_q4.onnx "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_q4.onnx"               # 305 MB, q4
curl -L -o onnx/model_q4f16.onnx "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_q4f16.onnx"         # 155 MB, q4f16
curl -L -o onnx/model_q8f16.onnx "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_q8f16.onnx"         # 86 MB, q8f16
curl -L -o onnx/model_uint8.onnx "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_uint8.onnx"         # 178 MB, uint8
curl -L -o onnx/model_uint8f16.onnx "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_uint8f16.onnx"   # 114 MB, uint8f16

### Caddy https certs and routing
sudo apt install -y caddy

sudo nano /etc/caddy/Caddyfile

#### replace Caddyfile with this:
tours.tony-wang.com {
    handle /api/* {
        uri strip_prefix /api
        reverse_proxy localhost:8000
    }
    handle {
        root * /home/g35tonywang/tour-guide-generator/build
        try_files {path} /index.html
        file_server
    }
}
 
sudo systemctl restart caddy

### pip and uvicorn
conda install pip

pip3 --version

cd backend
pip install -r requirements.txt
nohup uvicorn main:app --reload --host 0.0.0.0 --port 8000 > /tmp/uvicorn.log 2>&1 &
disown
```

# Update server
### Kill old instances

`ps -ef`

kill each of the following processes: 
* /home/g35tonywang/miniconda3/envs/tonys-tours/bin/python3.13 /home/g35tonywang/miniconda3/envs/tonys-tours/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000
* /usr/bin/node /home/g35tonywang/tour-guide-generator/node_modules/react-scripts/scripts/start.js

### Update code
`cd ~/tour-guide-generator`

`git pull`

### Restart servers

`conda env activate tonys-tours`

If dependencies were changed: `pip install -r requirements.txt`

`nohup npm start > /tmp/npm.log 2>&1 &`

`disown`

`cd backend`

`nohup uvicorn main:app --reload --host 0.0.0.0 --port 8000 > /tmp/uvicorn.log 2>&1 &`

`disown`