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
  const speechRef = useRef(null);
  const textContainerRef = useRef(null);

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
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentSentenceIndex(-1);
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
    
    return sentences.map((sentence, index) => {
      if (sentence.isParagraphBreak) {
        return <><br key={`br1-${index}`} /><br key={`br2-${index}`} /></>;
      }
      
      return (
        <span
          key={index}
          className={`sentence ${index === currentSentenceIndex ? 'sentence-highlighted' : ''}`}
        >
          {sentence.text}
          {index < sentences.length - 1 && !sentences[index + 1]?.isParagraphBreak ? ' ' : ''}
        </span>
      );
    });
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
      
      {isLoading && (
        <div className="loading-container">
          <div className="wrench-container">
            <div className="wrench">
              <div className="wrench-head"></div>
              <div className="wrench-handle"></div>
            </div>
          </div>
          <p className="loading-text">Creating your tour ...</p>
        </div>
      )}
      
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
