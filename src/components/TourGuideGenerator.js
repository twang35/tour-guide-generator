import React, { useState, useEffect, useRef } from 'react';
import './TourGuideGenerator.css';
import { getBackendUrl, getFallbackBackendUrl } from '../config';

const TourGuideGenerator = () => {
  const [location, setLocation] = useState('');
  const [tourGuideText, setTourGuideText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [availableVoices, setAvailableVoices] = useState([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);
  const [ttsEngine, setTtsEngine] = useState('kokoro');
  const [kokoroVoice, setKokoroVoice] = useState('am_liam');
  const [kokoroVoices, setKokoroVoices] = useState([]);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const speechRef = useRef(null);
  const textContainerRef = useRef(null);
  const audioRef = useRef(null);

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

  // Fetch Kokoro voices when engine is set to kokoro
  useEffect(() => {
    if (ttsEngine !== 'kokoro' || kokoroVoices.length > 0) return;

    const fetchKokoroVoices = async () => {
      try {
        const backendUrl = getBackendUrl();
        const response = await fetch(`${backendUrl}/kokoro-voices`);
        if (response.ok) {
          const data = await response.json();
          setKokoroVoices(data.voices);
        }
      } catch (err) {
        // Try fallback
        try {
          const fallbackUrl = getFallbackBackendUrl();
          const response = await fetch(`${fallbackUrl}/kokoro-voices`);
          if (response.ok) {
            const data = await response.json();
            setKokoroVoices(data.voices);
          }
        } catch (fallbackErr) {
          console.error('Failed to fetch Kokoro voices:', fallbackErr);
        }
      }
    };
    fetchKokoroVoices();
  }, [ttsEngine, kokoroVoices.length]);

  const generateTourGuide = async () => {
    setIsLoading(true);
    try {
      // Try production backend first
      const primaryBackendUrl = getBackendUrl();
      console.log('Attempting to connect to production backend at:', primaryBackendUrl);
      
      let response = await fetch(`${primaryBackendUrl}/generate-tour-guide`, {
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
      console.error('Production backend failed, trying fallback:', error);
      
      try {
        // Try fallback backend
        const fallbackBackendUrl = getFallbackBackendUrl();
        console.log('Attempting to connect to fallback backend at:', fallbackBackendUrl);
        
        const response = await fetch(`${fallbackBackendUrl}/generate-tour-guide`, {
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
        
      } catch (fallbackError) {
        console.error('Fallback backend also failed:', fallbackError);
        setTourGuideText(`Connection error: Unable to connect to any backend server. Tried: ${getBackendUrl()} and ${getFallbackBackendUrl()}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const speakText = () => {
    if (!tourGuideText || !('speechSynthesis' in window)) return;

    // Stop any current speech
    window.speechSynthesis.cancel();
    setCurrentSentenceIndex(-1);

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
      setCurrentSentenceIndex(0);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentSentenceIndex(-1);
    };

    utterance.onpause = () => {
      setIsPaused(true);
    };

    utterance.onresume = () => {
      setIsPaused(false);
    };

    // Track speech boundaries for highlighting
    utterance.onboundary = (event) => {
      console.log('Boundary event:', event.name, event.charIndex);
      
      if (event.name === 'sentence' || event.name === 'word') {
        // Find the sentence index based on character position
        const sentences = splitIntoSentences(tourGuideText);
        let currentCharCount = 0;
        let sentenceIndex = 0;
        
        for (let i = 0; i < sentences.length; i++) {
          if (sentences[i].isParagraphBreak) {
            currentCharCount += sentences[i].text.length;
          } else {
            currentCharCount += sentences[i].text.length + 1; // +1 for the space
          }
          
          if (currentCharCount > event.charIndex) {
            sentenceIndex = i;
            break;
          }
        }
        
        // Only update if it's a sentence boundary or if we're significantly into a new sentence
        if (event.name === 'sentence' || sentenceIndex !== currentSentenceIndex) {
          console.log('Setting sentence index to:', sentenceIndex);
          setCurrentSentenceIndex(sentenceIndex);
          
          // Scroll to the highlighted sentence
          setTimeout(() => {
            const highlightedElement = document.querySelector('.sentence-highlighted');
            if (highlightedElement && textContainerRef.current) {
              highlightedElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
              });
            }
          }, 100);
        }
      }
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
    if (ttsEngine === 'kokoro') {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    } else {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentSentenceIndex(-1);
  };

  const speakKokoro = async () => {
    if (!tourGuideText) return;

    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    window.speechSynthesis.cancel();

    setIsGeneratingAudio(true);
    setCurrentSentenceIndex(-1);

    try {
      const backendUrl = getBackendUrl();
      let response;
      try {
        response = await fetch(`${backendUrl}/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: tourGuideText, voice: kokoroVoice, speed: 1.0 }),
        });
      } catch {
        const fallbackUrl = getFallbackBackendUrl();
        response = await fetch(`${fallbackUrl}/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: tourGuideText, voice: kokoroVoice, speed: 1.0 }),
        });
      }

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      audioRef.current.src = url;

      audioRef.current.onplay = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };
      audioRef.current.onpause = () => {
        if (audioRef.current && audioRef.current.currentTime < audioRef.current.duration) {
          setIsPaused(true);
        }
      };
      audioRef.current.onended = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        URL.revokeObjectURL(url);
      };

      await audioRef.current.play();
    } catch (err) {
      console.error('Kokoro TTS failed:', err);
      alert('Failed to generate audio. Make sure the backend is running with Kokoro model files.');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const pauseKokoro = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const resumeKokoro = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPaused(false);
    }
  };

  // Split text into sentences for highlighting while preserving paragraph breaks
  const splitIntoSentences = (text) => {
    // First split by double line breaks to preserve paragraphs
    const paragraphs = text.split(/\n\n+/);
    
    const sentences = [];
    paragraphs.forEach((paragraph, paragraphIndex) => {
      // Split each paragraph into sentences
      const paragraphSentences = paragraph.split(/(?<=[.!?])\s+/).filter(sentence => sentence.trim().length > 0);
      
      paragraphSentences.forEach((sentence, sentenceIndex) => {
        sentences.push({
          text: sentence,
          paragraphIndex,
          sentenceIndex,
          isParagraphStart: sentenceIndex === 0
        });
      });
      
      // Add paragraph break after each paragraph (except the last one)
      if (paragraphIndex < paragraphs.length - 1) {
        sentences.push({
          text: '\n\n\n',
          paragraphIndex,
          sentenceIndex: -1,
          isParagraphBreak: true
        });
      }
    });
    
    return sentences;
  };

  // Render text with sentence highlighting
  const renderHighlightedText = (text) => {
    if (!text) return null;

    const sentences = splitIntoSentences(text);
    const enableHighlight = ttsEngine === 'browser';

    return sentences.map((sentence, index) => {
      if (sentence.isParagraphBreak) {
        return <><br key={`br1-${index}`} /><br key={`br2-${index}`} /></>;
      }

      return (
        <span
          key={index}
          className={`sentence ${enableHighlight && index === currentSentenceIndex ? 'sentence-highlighted' : ''}`}
        >
          {sentence.text}
          {index < sentences.length - 1 && !sentences[index + 1]?.isParagraphBreak ? ' ' : ''}
        </span>
      );
    });
  };

  return (
    <div className="tour-generator-container">
      <h1>Tony's Tours</h1>
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
          {isLoading ? 'Generating...' : 'Generate Tour'}
        </button>
      </div>
      
      {isLoading && (
        <div className="loading-container">
          <div className="wrench-container">
            <svg className="wrench" viewBox="-1 0 32 31" width="60" height="60">
              <path d="M28.6 24.9l-15-15c-1.4-1.4-3.4-4.2-4.5-6.5-2.6-1.2-5.5-.6-7.4 1.3L7.2 7.3 5.4 11.1-.2 8.6C-.5 11.2 1 13.9 3.5 15.1c.6 1.4 4.2-3.6 6.3-1.5l15 15a2.65 2.65 0 0 0 3.8-3.7zM28.2 26.8a1.5 1.5 0 1 0-3 0 1.5 1.5 0 1 0 3 0z" fill="#3498db" stroke="#2980b9" strokeWidth="1" fillRule="evenodd"/>
            </svg>
          </div>
          <p className="loading-text">Creating your tour ...</p>
        </div>
      )}
      
      {tourGuideText && (
        <>
          <div className="speech-controls">
            <h3>Audio Controls</h3>
            <div className="voice-settings">
              <div className="setting-group engine-selector">
                <label htmlFor="engine-select">TTS Engine:</label>
                <select
                  id="engine-select"
                  value={ttsEngine}
                  onChange={(e) => {
                    stopSpeech();
                    setTtsEngine(e.target.value);
                  }}
                  disabled={isSpeaking || isGeneratingAudio}
                >
                  <option value="browser">Browser TTS</option>
                  <option value="kokoro">Kokoro TTS</option>
                </select>
              </div>
              {ttsEngine === 'browser' ? (
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
              ) : (
                <div className="setting-group">
                  <label htmlFor="kokoro-voice-select">Voice:</label>
                  <select
                    id="kokoro-voice-select"
                    value={kokoroVoice}
                    onChange={(e) => setKokoroVoice(e.target.value)}
                    disabled={isSpeaking || isGeneratingAudio}
                  >
                    {kokoroVoices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="speech-buttons">
              {!isSpeaking && !isPaused && (
                <button
                  onClick={ttsEngine === 'kokoro' ? speakKokoro : speakText}
                  className="speech-btn play-btn"
                  disabled={!tourGuideText || isGeneratingAudio}
                >
                  {isGeneratingAudio ? 'Generating audio...' : '🔊 Play Audio'}
                </button>
              )}

              {isSpeaking && !isPaused && (
                <button
                  onClick={ttsEngine === 'kokoro' ? pauseKokoro : pauseSpeech}
                  className="speech-btn pause-btn"
                >
                  ⏸️ Pause
                </button>
              )}

              {isPaused && (
                <button
                  onClick={ttsEngine === 'kokoro' ? resumeKokoro : resumeSpeech}
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
          
          <div className="tour-guide-output" ref={textContainerRef}>
            <div className="tour-guide-text">
              {renderHighlightedText(tourGuideText)}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TourGuideGenerator;
