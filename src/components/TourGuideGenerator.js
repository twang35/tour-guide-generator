import React, { useState } from 'react';
import './TourGuideGenerator.css';

const TourGuideGenerator = () => {
  const [location, setLocation] = useState('');
  const [tourGuideText, setTourGuideText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const generateTourGuide = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/generate-tour-guide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ location }),
      });
      const data = await response.json();
      setTourGuideText(data.tour_guide_text);
    } catch (error) {
      console.error('Error generating tour guide:', error);
      setTourGuideText('Error generating tour guide text. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
          className="location-input"
        />
        <button onClick={generateTourGuide} disabled={isLoading}>
          {isLoading ? 'Generating...' : 'Generate Tour Guide'}
        </button>
      </div>
      {tourGuideText && (
        <div className="tour-guide-output">
          <h2>Your Tour Guide Text:</h2>
          <pre>{tourGuideText}</pre>
        </div>
      )}
    </div>
  );
};

export default TourGuideGenerator;
