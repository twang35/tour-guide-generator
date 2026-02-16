import React, { useState, useEffect, useRef } from 'react';
import './TourGuideGenerator.css';
import { getBackendUrl, getFallbackBackendUrl } from '../config';
import { KokoroWebGPUClient } from '../kokoroWebGPU';

const TourGuideGenerator = () => {
  const [location, setLocation] = useState('');
  const [tourGuideText, setTourGuideText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [availableVoices, setAvailableVoices] = useState([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(-1);
  const [ttsEngine, setTtsEngine] = useState('kokoro-webgpu');
  const [kokoroVoice, setKokoroVoice] = useState('am_liam');
  const [kokoroVoices, setKokoroVoices] = useState([]);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [webgpuSupported, setWebgpuSupported] = useState(false);
  const [webgpuModelStatus, setWebgpuModelStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
  const [webgpuLoadProgress, setWebgpuLoadProgress] = useState(null);
  const speechRef = useRef(null);
  const textContainerRef = useRef(null);
  const audioRef = useRef(null);
  const kokoroAbortRef = useRef(null);
  const kokoroWebGPURef = useRef(null);
  const prefetchedFirstParaRef = useRef(null); // { promise, voice } for first paragraph audio

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

  // Detect WebGPU support and start loading the model immediately on mount
  useEffect(() => {
    const initWebGPU = async () => {
      if (!navigator.gpu) return;
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) return;
      } catch {
        return;
      }
      setWebgpuSupported(true);
      setWebgpuModelStatus('loading');
      setWebgpuLoadProgress(null);
      try {
        const client = new KokoroWebGPUClient();
        kokoroWebGPURef.current = client;
        await client.init({
          dtype: 'fp32',
          onProgress: (progress) => {
            setWebgpuLoadProgress(progress);
          },
        });
        setWebgpuModelStatus('ready');
      } catch (err) {
        console.error('WebGPU model load failed:', err);
        setWebgpuModelStatus('error');
      }
    };
    initWebGPU();
  }, []);

  // Cleanup Kokoro pipeline on unmount
  useEffect(() => {
    return () => {
      if (kokoroAbortRef.current) {
        kokoroAbortRef.current.abort();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (kokoroWebGPURef.current) {
        kokoroWebGPURef.current.dispose();
      }
    };
  }, []);

  // Fetch Kokoro voices when engine is set to kokoro or kokoro-webgpu
  useEffect(() => {
    if ((ttsEngine !== 'kokoro' && ttsEngine !== 'kokoro-webgpu') || kokoroVoices.length > 0) return;

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

  const prefetchFirstParagraphAudio = (text) => {
    prefetchedFirstParaRef.current = null;
    const client = kokoroWebGPURef.current;
    if (!client || webgpuModelStatus !== 'ready') return;
    const firstPara = text.split(/\n\n+/).filter(p => p.trim().length > 0)[0];
    if (!firstPara) return;
    const voice = kokoroVoice;
    const startTime = performance.now();
    const promise = client.generate(firstPara, voice, 1.0).then(blob => {
      console.log(`[AudioGen:WebGPU] First paragraph prefetched in ${(performance.now() - startTime).toFixed(0)}ms (${firstPara.length} chars)`);
      return blob;
    }).catch(err => {
      console.warn('[AudioGen:WebGPU] First paragraph prefetch failed:', err);
      return null;
    });
    prefetchedFirstParaRef.current = { promise, voice };
  };

  const generateTourGuide = async () => {
    // Stop any running Kokoro pipeline
    if (kokoroAbortRef.current) {
      kokoroAbortRef.current.abort();
      kokoroAbortRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (kokoroWebGPURef.current) {
      kokoroWebGPURef.current.abortAll();
    }
    prefetchedFirstParaRef.current = null;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentSentenceIndex(-1);
    setCurrentParagraphIndex(-1);
    setIsGeneratingAudio(false);

    setIsLoading(true);
    try {
      // Try production backend first
      const primaryBackendUrl = getBackendUrl();
      console.log('Attempting to connect to production backend at:', primaryBackendUrl);
      
      const textGenStart = performance.now();
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
      console.log(`[TextGen] Generated tour text in ${(performance.now() - textGenStart).toFixed(0)}ms`);
      setTourGuideText(data.tour_guide_text);
      prefetchFirstParagraphAudio(data.tour_guide_text);

    } catch (error) {
      console.error('Production backend failed, trying fallback:', error);
      
      try {
        // Try fallback backend
        const fallbackBackendUrl = getFallbackBackendUrl();
        console.log('Attempting to connect to fallback backend at:', fallbackBackendUrl);
        
        const textGenStartFallback = performance.now();
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
        console.log(`[TextGen] Generated tour text (fallback) in ${(performance.now() - textGenStartFallback).toFixed(0)}ms`);
        setTourGuideText(data.tour_guide_text);
        prefetchFirstParagraphAudio(data.tour_guide_text);

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
    if (ttsEngine === 'kokoro' || ttsEngine === 'kokoro-webgpu') {
      if (kokoroAbortRef.current) {
        kokoroAbortRef.current.abort();
        kokoroAbortRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (ttsEngine === 'kokoro-webgpu' && kokoroWebGPURef.current) {
        kokoroWebGPURef.current.abortAll();
      }
    } else {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentSentenceIndex(-1);
    setCurrentParagraphIndex(-1);
    setIsGeneratingAudio(false);
  };

  const fetchTTSAudio = async (text, signal) => {
    const backendUrl = getBackendUrl();
    let response;
    try {
      response = await fetch(`${backendUrl}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: kokoroVoice, speed: 1.0 }),
        signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      const fallbackUrl = getFallbackBackendUrl();
      response = await fetch(`${fallbackUrl}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: kokoroVoice, speed: 1.0 }),
        signal,
      });
    }
    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.status}`);
    }
    return await response.blob();
  };

  const speakKokoro = async () => {
    if (!tourGuideText) return;

    // Stop any current playback
    if (kokoroAbortRef.current) {
      kokoroAbortRef.current.abort();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    window.speechSynthesis.cancel();

    const abortController = new AbortController();
    kokoroAbortRef.current = abortController;

    const paragraphs = tourGuideText.split(/\n\n+/).filter(p => p.trim().length > 0);
    if (paragraphs.length === 0) return;

    setIsGeneratingAudio(true);
    setCurrentSentenceIndex(-1);
    setCurrentParagraphIndex(-1);

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    let prefetchPromise = null;

    try {
      for (let i = 0; i < paragraphs.length; i++) {
        if (abortController.signal.aborted) break;

        // Get audio for this paragraph (use pre-fetched result or fetch now)
        let blob;
        if (prefetchPromise) {
          const prefetchStart = performance.now();
          blob = await prefetchPromise;
          console.log(`[AudioGen] Paragraph ${i + 1}/${paragraphs.length} (prefetched, waited ${(performance.now() - prefetchStart).toFixed(0)}ms)`);
          prefetchPromise = null;
        }
        if (!blob) {
          const audioGenStart = performance.now();
          blob = await fetchTTSAudio(paragraphs[i], abortController.signal);
          console.log(`[AudioGen] Paragraph ${i + 1}/${paragraphs.length} generated in ${(performance.now() - audioGenStart).toFixed(0)}ms (${paragraphs[i].length} chars)`);
        }

        if (abortController.signal.aborted) break;

        // Once we have the first paragraph's audio, we're no longer "generating"
        if (i === 0) {
          setIsGeneratingAudio(false);
        }

        // Start pre-fetching the next paragraph
        if (i + 1 < paragraphs.length) {
          const prefetchIdx = i + 1;
          const prefetchGenStart = performance.now();
          prefetchPromise = fetchTTSAudio(paragraphs[prefetchIdx], abortController.signal).then(result => {
            console.log(`[AudioGen] Paragraph ${prefetchIdx + 1}/${paragraphs.length} prefetch completed in ${(performance.now() - prefetchGenStart).toFixed(0)}ms (${paragraphs[prefetchIdx].length} chars)`);
            return result;
          }).catch(err => {
            if (err.name !== 'AbortError') console.error('Prefetch failed:', err);
            return null;
          });
        }

        const url = URL.createObjectURL(blob);
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

        setCurrentParagraphIndex(i);
        await audioRef.current.play();

        // Wait for audio to end or abort
        await new Promise(resolve => {
          const onEnded = () => { cleanup(); resolve(); };
          const onAbort = () => { cleanup(); resolve(); };
          const cleanup = () => {
            audioRef.current.removeEventListener('ended', onEnded);
            abortController.signal.removeEventListener('abort', onAbort);
          };
          audioRef.current.addEventListener('ended', onEnded, { once: true });
          abortController.signal.addEventListener('abort', onAbort, { once: true });
        });

        URL.revokeObjectURL(url);

        if (abortController.signal.aborted) break;

        // Pause between paragraphs
        if (i + 1 < paragraphs.length) {
          await new Promise(resolve => {
            const timer = setTimeout(resolve, 300);
            const onAbort = () => { clearTimeout(timer); resolve(); };
            abortController.signal.addEventListener('abort', onAbort, { once: true });
          });
          if (abortController.signal.aborted) break;
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Kokoro TTS failed:', err);
        alert('Failed to generate audio. Make sure the backend is running with Kokoro model files.');
      }
    } finally {
      setIsGeneratingAudio(false);
      if (!abortController.signal.aborted) {
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentParagraphIndex(-1);
      }
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

  const speakKokoroWebGPU = async () => {
    if (!tourGuideText) return;
    const client = kokoroWebGPURef.current;
    if (!client) return;

    // Stop any current playback
    if (kokoroAbortRef.current) {
      kokoroAbortRef.current.abort();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    window.speechSynthesis.cancel();

    const abortController = new AbortController();
    kokoroAbortRef.current = abortController;

    const paragraphs = tourGuideText.split(/\n\n+/).filter(p => p.trim().length > 0);
    if (paragraphs.length === 0) return;

    setIsGeneratingAudio(true);
    setCurrentSentenceIndex(-1);
    setCurrentParagraphIndex(-1);

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    let prefetchPromise = null;

    // Check if we have a prefetched first paragraph from text generation
    const prefetched = prefetchedFirstParaRef.current;
    if (prefetched && prefetched.voice === kokoroVoice) {
      prefetchPromise = prefetched.promise;
    }
    prefetchedFirstParaRef.current = null;

    try {
      for (let i = 0; i < paragraphs.length; i++) {
        if (abortController.signal.aborted) break;

        // Get audio for this paragraph (use pre-fetched result or generate now)
        let blob;
        if (prefetchPromise) {
          const prefetchStart = performance.now();
          blob = await prefetchPromise;
          console.log(`[AudioGen:WebGPU] Paragraph ${i + 1}/${paragraphs.length} (prefetched, waited ${(performance.now() - prefetchStart).toFixed(0)}ms)`);
          prefetchPromise = null;
        }
        if (!blob) {
          const audioGenStart = performance.now();
          blob = await client.generate(paragraphs[i], kokoroVoice, 1.0);
          console.log(`[AudioGen:WebGPU] Paragraph ${i + 1}/${paragraphs.length} generated in ${(performance.now() - audioGenStart).toFixed(0)}ms (${paragraphs[i].length} chars)`);
        }

        if (abortController.signal.aborted) break;

        // Once we have the first paragraph's audio, we're no longer "generating"
        if (i === 0) {
          setIsGeneratingAudio(false);
        }

        // Start pre-fetching the next paragraph
        if (i + 1 < paragraphs.length) {
          const prefetchIdx = i + 1;
          const prefetchGenStart = performance.now();
          prefetchPromise = client.generate(paragraphs[prefetchIdx], kokoroVoice, 1.0).then(result => {
            console.log(`[AudioGen:WebGPU] Paragraph ${prefetchIdx + 1}/${paragraphs.length} prefetch completed in ${(performance.now() - prefetchGenStart).toFixed(0)}ms (${paragraphs[prefetchIdx].length} chars)`);
            return result;
          }).catch(err => {
            if (err.message !== 'Aborted') console.error('Prefetch failed:', err);
            return null;
          });
        }

        const url = URL.createObjectURL(blob);
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

        setCurrentParagraphIndex(i);
        await audioRef.current.play();

        // Wait for audio to end or abort
        await new Promise(resolve => {
          const onEnded = () => { cleanup(); resolve(); };
          const onAbort = () => { cleanup(); resolve(); };
          const cleanup = () => {
            audioRef.current.removeEventListener('ended', onEnded);
            abortController.signal.removeEventListener('abort', onAbort);
          };
          audioRef.current.addEventListener('ended', onEnded, { once: true });
          abortController.signal.addEventListener('abort', onAbort, { once: true });
        });

        URL.revokeObjectURL(url);

        if (abortController.signal.aborted) break;

        // Pause between paragraphs
        if (i + 1 < paragraphs.length) {
          await new Promise(resolve => {
            const timer = setTimeout(resolve, 300);
            const onAbort = () => { clearTimeout(timer); resolve(); };
            abortController.signal.addEventListener('abort', onAbort, { once: true });
          });
          if (abortController.signal.aborted) break;
        }
      }
    } catch (err) {
      if (err.message !== 'Aborted') {
        console.error('Kokoro WebGPU TTS failed:', err);
        alert('Failed to generate audio with Kokoro WebGPU.');
      }
    } finally {
      setIsGeneratingAudio(false);
      if (!abortController.signal.aborted) {
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentParagraphIndex(-1);
      }
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

  // Auto-scroll when current paragraph changes (Kokoro)
  useEffect(() => {
    if (currentParagraphIndex >= 0 && (ttsEngine === 'kokoro' || ttsEngine === 'kokoro-webgpu')) {
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
  }, [currentParagraphIndex, ttsEngine]);

  // Render text with sentence highlighting
  const renderHighlightedText = (text) => {
    if (!text) return null;

    const sentences = splitIntoSentences(text);

    return sentences.map((sentence, index) => {
      if (sentence.isParagraphBreak) {
        return <><br key={`br1-${index}`} /><br key={`br2-${index}`} /></>;
      }

      const isBrowserHighlight = ttsEngine === 'browser' && index === currentSentenceIndex;
      const isKokoroHighlight = (ttsEngine === 'kokoro' || ttsEngine === 'kokoro-webgpu') && currentParagraphIndex >= 0 && sentence.paragraphIndex === currentParagraphIndex;
      const isHighlighted = isBrowserHighlight || isKokoroHighlight;

      return (
        <span
          key={index}
          className={`sentence ${isHighlighted ? 'sentence-highlighted' : ''}`}
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
                  <option value="kokoro">Kokoro (Server)</option>
                  <option value="kokoro-webgpu" disabled={!webgpuSupported}>
                    Kokoro WebGPU{!webgpuSupported ? ' (not supported)' : ''}
                  </option>
                </select>
              </div>
              {webgpuModelStatus === 'loading' && ttsEngine === 'kokoro-webgpu' && (
                <div className="setting-group webgpu-loading">
                  <label>Model loading...</label>
                  <div className="webgpu-progress-bar">
                    <div
                      className="webgpu-progress-fill"
                      style={{
                        width: `${webgpuLoadProgress?.progress != null ? Math.round(webgpuLoadProgress.progress) : 0}%`,
                      }}
                    />
                  </div>
                  <span>
                    {webgpuLoadProgress?.progress != null
                      ? `${Math.round(webgpuLoadProgress.progress)}%`
                      : 'Initializing...'}
                    {webgpuLoadProgress?.file ? ` — ${webgpuLoadProgress.file}` : ''}
                  </span>
                </div>
              )}
              {webgpuModelStatus === 'error' && ttsEngine === 'kokoro-webgpu' && (
                <div className="setting-group webgpu-error">
                  <span className="webgpu-error-text">Failed to load model.</span>
                  <button
                    className="webgpu-retry-btn"
                    onClick={async () => {
                      if (kokoroWebGPURef.current) {
                        kokoroWebGPURef.current.dispose();
                        kokoroWebGPURef.current = null;
                      }
                      setWebgpuModelStatus('loading');
                      setWebgpuLoadProgress(null);
                      try {
                        const client = new KokoroWebGPUClient();
                        kokoroWebGPURef.current = client;
                        await client.init({
                          dtype: 'fp32',
                          onProgress: (progress) => {
                            setWebgpuLoadProgress(progress);
                          },
                        });
                        setWebgpuModelStatus('ready');
                      } catch (err) {
                        console.error('WebGPU model load failed:', err);
                        setWebgpuModelStatus('error');
                      }
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
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
              ) : (ttsEngine === 'kokoro' || ttsEngine === 'kokoro-webgpu') ? (
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
              ) : null}
            </div>

            <div className="speech-buttons">
              {!isSpeaking && !isPaused && (
                <button
                  onClick={ttsEngine === 'kokoro-webgpu' ? speakKokoroWebGPU : ttsEngine === 'kokoro' ? speakKokoro : speakText}
                  className="speech-btn play-btn"
                  disabled={!tourGuideText || isGeneratingAudio || (ttsEngine === 'kokoro-webgpu' && webgpuModelStatus !== 'ready')}
                >
                  {isGeneratingAudio ? 'Generating audio...' : (ttsEngine === 'kokoro-webgpu' && webgpuModelStatus === 'loading') ? 'Loading model...' : '🔊 Play Audio'}
                </button>
              )}

              {isSpeaking && !isPaused && (
                <button
                  onClick={(ttsEngine === 'kokoro' || ttsEngine === 'kokoro-webgpu') ? pauseKokoro : pauseSpeech}
                  className="speech-btn pause-btn"
                >
                  ⏸️ Pause
                </button>
              )}

              {isPaused && (
                <button
                  onClick={(ttsEngine === 'kokoro' || ttsEngine === 'kokoro-webgpu') ? resumeKokoro : resumeSpeech}
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
