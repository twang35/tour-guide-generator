import React, { useState, useEffect, useRef } from 'react';
import './TourGuideGenerator.css';
import { getBackendUrl } from '../config';

const TourGuideGenerator = () => {
  const [location, setLocation] = useState('');
  const [tourGuideText, setTourGuideText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [availableVoices, setAvailableVoices] = useState([]);
  const speechRef = useRef(null);

  // Initialize speech synthesis and get available voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // Wait for voices to load
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        // Filter to only English voices
        const englishVoices = voices.filter(voice => 
          voice.lang.startsWith('en')
        );
        setAvailableVoices(englishVoices);
        // Set default voice to first available English voice
        const englishVoice = englishVoices.find(voice => voice.default) || englishVoices[0];
        if (englishVoice) {
          setSelectedVoice(englishVoice.name);
        }
      };

      // Load voices immediately if available
      loadVoices();
      
      // Also listen for voices loaded event
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);



  const generateTourGuide = async () => {
    setIsLoading(true);
    try {
      const backendUrl = getBackendUrl();
      console.log('Attempting to connect to backend at:', backendUrl);
      
      const response = await fetch(`${backendUrl}/generate-tour-guide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ location }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setTourGuideText(data.tour_guide_text);
    } catch (error) {
      console.error('Error generating tour guide:', error);
      if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED')) {
        setTourGuideText(`Connection error: Unable to connect to backend server. Please ensure the backend server is running on port 8000. Current backend URL: ${getBackendUrl()}`);
      } else {
        setTourGuideText(`Error generating tour guide text: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const speakText = () => {
    if (!tourGuideText || !('speechSynthesis' in window)) return;

    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(tourGuideText);
    
    // Set voice
    const voice = availableVoices.find(v => v.name === selectedVoice);
    if (voice) {
      utterance.voice = voice;
    }

    // Set speech properties
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Event handlers
    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onpause = () => {
      setIsPaused(true);
    };

    utterance.onresume = () => {
      setIsPaused(false);
    };

    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const pauseSpeech = () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
    }
  };

  const resumeSpeech = () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  };

  const stopSpeech = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  return (
    <div className="tour-generator-container">
      <h1>Tour Guide Generator</h1>
      <div className="input-container">
        <input
          type="text"
          placeholder="Enter a location..."
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isLoading && location) {
              generateTourGuide();
            }
          }}
          className="location-input"
        />
        <button onClick={generateTourGuide} disabled={isLoading || !location}>
          {isLoading ? 'Generating...' : 'Generate Tour Guide'}
        </button>
      </div>
      
      {tourGuideText && (
        <>
          <div className="speech-controls">
            <h3>Audio Controls</h3>
            <div className="voice-settings">
              <div className="setting-group">
                <label htmlFor="voice-select">Voice:</label>
                <select
                  id="voice-select"
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  disabled={isSpeaking}
                >
                  {availableVoices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="speech-buttons">
              {!isSpeaking && !isPaused && (
                <button 
                  onClick={speakText}
                  className="speech-btn play-btn"
                  disabled={!tourGuideText}
                >
                  🔊 Play Audio
                </button>
              )}
              
              {isSpeaking && !isPaused && (
                <button 
                  onClick={pauseSpeech}
                  className="speech-btn pause-btn"
                >
                  ⏸️ Pause
                </button>
              )}
              
              {isPaused && (
                <button 
                  onClick={resumeSpeech}
                  className="speech-btn resume-btn"
                >
                  ▶️ Resume
                </button>
              )}
              
              {(isSpeaking || isPaused) && (
                <button 
                  onClick={stopSpeech}
                  className="speech-btn stop-btn"
                >
                  ⏹️ Stop
                </button>
              )}
            </div>
          </div>
          
          <div className="tour-guide-output">
            <h3>Generated Tour Guide</h3>
            <pre>{tourGuideText}</pre>
          </div>
        </>
      )}
    </div>
  );
};

export default TourGuideGenerator;
