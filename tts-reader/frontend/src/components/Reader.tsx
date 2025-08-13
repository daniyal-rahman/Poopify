// components/Reader.tsx
import React, { useState, useEffect, useRef } from 'react';
import Player from '../audio/Player';
const initRef = { current: false }; // guard StrictMode double-mount

interface ReaderProps { doc: any; }

const Reader: React.FC<ReaderProps> = ({ doc }) => {
  const [rate, setRate] = useState(1.3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSentenceId, setCurrentSentenceId] = useState<string | null>(null);
  const playerRef = useRef<Player | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (initRef.current) return;      // StrictMode: run once
    initRef.current = true;

    playerRef.current = new Player();

    // Use Vite proxy & same-origin; works in dev/prod
    const wsUrl = `ws://localhost:8000/api/stream`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WS open');
      // You can still send config JSON if you want to override reading_order/start_index
      ws.send(JSON.stringify({
        doc_id: doc.doc_id,
        reading_order: doc.reading_order,
        start_index: 0
      }));
    };

    ws.onmessage = (event) => {
      const data = event.data;
      if (typeof data === 'string') {
        try {
          const msg = JSON.parse(data);
          if (msg.type === 'mark') setCurrentSentenceId(msg.sentence_id);
          if (msg.type === 'ready') console.log('Server ready for doc', msg.doc_id);
        } catch {/* ignore */}
        return;
      }
      if (data instanceof ArrayBuffer) {
        const pcm16 = new Int16Array(data);
        // @ts-ignore - method exists on our Player
        playerRef.current?.addChunkPCM16(pcm16);
        if (isPlaying) playerRef.current?.play();
      }
    };

    ws.onclose = (e) => {
      console.log('WebSocket disconnected', e.code, e.reason);
    };
    ws.onerror = (e) => console.error('WS error', e);

    return () => {
      try { ws.close(1000, 'client navigating away'); } catch {}
      playerRef.current?.stop();
      playerRef.current = null;
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]); // reconnect when doc changes

  // Live rate changes: tell server (prosody) AND adjust local time-stretch instantly
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'control', rate }));
    }
    playerRef.current?.setRate(rate);
  }, [rate]);

  const handlePlayPause = () => {
    if (isPlaying) playerRef.current?.pause();
    else playerRef.current?.play();
    setIsPlaying(!isPlaying);
  };

  return (
    <div>
      <h2>Reader</h2>
      <div>
        <button onClick={handlePlayPause}>{isPlaying ? 'Pause' : 'Play'}</button>
        <label>
          Speed: {rate.toFixed(1)}x
          <input min="0.8" max="2.5" step="0.1" type="range"
                 value={rate} onChange={(e)=>setRate(parseFloat(e.target.value))}/>
        </label>
      </div>
      <div className="document-view">
        {doc.blocks.map((block: any) => (
          <div key={block.id} className={`block role-${block.role}`}>
            {block.sentences.map((s: any, idx: number) => (
              <span key={idx} className={currentSentenceId === `${block.id}_s${idx}` ? 'highlight' : ''}>
                {s.text}{' '}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Reader;
