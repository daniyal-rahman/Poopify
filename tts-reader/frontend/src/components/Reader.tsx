import React, { useState, useEffect, useRef } from 'react';
import Player from '../audio/Player';

interface ReaderProps {
  doc: any;
}

const Reader: React.FC<ReaderProps> = ({ doc }) => {
  const [rate, setRate] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSentenceId, setCurrentSentenceId] = useState<string | null>(null);
  const playerRef = useRef<Player | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Effect for WebSocket connection management
  useEffect(() => {
    playerRef.current = new Player();
    
    const wsUrl = `ws://localhost:8000/api/stream`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
      // Send initial configuration once connected
      wsRef.current?.send(JSON.stringify({
        doc_id: doc.doc_id,
        reading_order: doc.reading_order,
        rate: rate, // Send initial rate
        start_index: 0,
      }));
    };

    wsRef.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'audio' && msg.pcm16_base64) {
        // Decode Base64 to binary string
        const binaryString = atob(msg.pcm16_base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        // Create Int16Array from the bytes
        const buffer = new Int16Array(bytes.buffer);
        playerRef.current?.addChunk(buffer);
        if (playerRef.current?.isPlaying) {
            playerRef.current?.play();
        }
      } else if (msg.type === 'mark') {
        setCurrentSentenceId(msg.sentence_id);
      }
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected');
    };
    
    wsRef.current.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    // Cleanup on component unmount
    return () => {
      wsRef.current?.close();
      playerRef.current?.stop();
    };
  }, [doc]); // This effect runs only when the document changes

  // Effect for handling rate changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'control', rate: rate }));
    }
    playerRef.current?.setRate(rate);
  }, [rate]); // This effect runs only when the rate changes

  const handlePlayPause = () => {
    if (isPlaying) {
      playerRef.current?.pause();
    } else {
      playerRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleRateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRate(parseFloat(event.target.value));
  };

  return (
    <div>
      <h2>Reader</h2>
      <div>
        <button onClick={handlePlayPause}>{isPlaying ? 'Pause' : 'Play'}</button>
        <label>
          Speed: {rate.toFixed(1)}x
          <input
            type="range"
            min="0.8"
            max="2.5"
            step="0.1"
            value={rate}
            onChange={handleRateChange}
          />
        </label>
      </div>
      <div className="document-view">
        {doc.blocks.map((block) => (
          <div key={block.id} className={`block role-${block.role}`}>
            {block.sentences.map((sentence, s_idx) => (
              <span
                key={s_idx}
                className={currentSentenceId === `${block.id}_s${s_idx}` ? 'highlight' : ''}
              >
                {sentence.text}{' '}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Reader;
