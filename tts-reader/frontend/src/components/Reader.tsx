import React, { useState, useEffect, useRef } from 'react';
import Player from '../audio/Player';

interface ReaderProps { doc: any; }

// Keep control-to-server off to avoid accidental double-speed.
// Client handles tempo (pitch-preserving).
const CONTROL_TO_SERVER = false;

const Reader: React.FC<ReaderProps> = ({ doc }) => {
  const [tempo, setTempo] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSentenceId, setCurrentSentenceId] = useState<string | null>(null);

  const playerRef = useRef<Player | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const connectingRef = useRef(false);
  const destroyedRef = useRef(false);
  const serverSampleRateRef = useRef<number | null>(null);

  // 1) Create Player exactly once (don’t tear down on dev StrictMode unmount)
  useEffect(() => {
    if (!playerRef.current) {
      playerRef.current = new Player();
      // Prefer a pitch-preserving API if Player supports it
      playerRef.current.setTempo?.(tempo);
      playerRef.current.setRate?.(tempo); // fallback if setTempo doesn't exist
    }

    // DevTools helper (safe getters)
    (window as any).__audioDebug = {
      get ctx() { return playerRef.current?.audioCtx ?? null; },
      get sr() { return playerRef.current?.audioCtx?.sampleRate ?? null; },
      get serverSR() { return serverSampleRateRef.current; },
      player: playerRef.current
    };

    return () => {
      if (import.meta.env.PROD) {
        try { playerRef.current?.stop(); } catch {}
        playerRef.current = null;
      }
      // In dev, do NOT stop here — StrictMode will fake-unmount once
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) WebSocket connect + simple backoff reconnect (no teardown in dev)
  useEffect(() => {
    const wsUrl = 'ws://127.0.0.1:8000/api/stream'; // prefer 127.0.0.1 to avoid IPv6 localhost quirks

    const ensureWS = () => {
      if (destroyedRef.current) return;
      const cur = wsRef.current;
      if (cur && (cur.readyState === WebSocket.OPEN || cur.readyState === WebSocket.CONNECTING)) return;
      if (connectingRef.current) return;

      connectingRef.current = true;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        connectingRef.current = false;
        // If your server needs doc metadata on open, send it here (harmless if ignored)
        try {
          ws.send(JSON.stringify({
            type: 'doc',
            doc_id: doc.doc_id,
            reading_order: doc.reading_order,
            start_index: 0
          }));
          if (CONTROL_TO_SERVER) {
            ws.send(JSON.stringify({ type: 'control', rate: tempo }));
          }
        } catch {}
      };

      ws.onmessage = (event) => {
        const data = event.data;

        if (typeof data === 'string') {
          // Control / marks from server
          try {
            const msg = JSON.parse(data);
            if (msg.type === 'mark') {
              setCurrentSentenceId(msg.sentence_id ?? null);
              if (typeof msg.sample_rate === 'number') {
                serverSampleRateRef.current = msg.sample_rate;
                // If your Player supports it, update input SR dynamically
                (playerRef.current as any)?.setInputSampleRate?.(msg.sample_rate);
              }
            }
            if (msg.type === 'hello' && typeof msg.sample_rate === 'number') {
              serverSampleRateRef.current = msg.sample_rate;
              (playerRef.current as any)?.setInputSampleRate?.(msg.sample_rate);
            }
          } catch { /* ignore parse errors */ }
          return;
        }

        // Binary PCM16 (LE), mono — streamed in ~20 ms frames
        if (data instanceof ArrayBuffer) {
          const pcm16 = new Int16Array(data);
          // @ts-ignore Player has addChunkPCM16
          playerRef.current?.addChunkPCM16(pcm16);
          if (isPlaying) playerRef.current?.play();
        }
      };

      ws.onerror = (e) => {
        console.log('WS error', e);
      };

      ws.onclose = (e) => {
        console.log('WS closed', e.code, e.reason || '');
        wsRef.current = null;
        connectingRef.current = false;
        if (!destroyedRef.current) {
          if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = window.setTimeout(ensureWS, 800);
        }
      };
    };

    ensureWS();

    return () => {
      destroyedRef.current = true;
      if (import.meta.env.PROD) {
        try { wsRef.current?.close(1000, 'component unmount'); } catch {}
        wsRef.current = null;
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3) On doc change, notify server without tearing down the socket
  useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({
          type: 'doc',
          doc_id: doc.doc_id,
          reading_order: doc.reading_order,
          start_index: 0
        }));
      } catch {}
    }
  }, [doc]);

  // 4) Live tempo changes: client-side only (pitch-preserving). Don’t also control server.
  useEffect(() => {
    playerRef.current?.setTempo?.(tempo);
    playerRef.current?.setRate?.(tempo);
    if (CONTROL_TO_SERVER && wsRef.current?.readyState === WebSocket.OPEN) {
      try { wsRef.current.send(JSON.stringify({ type: 'control', rate: tempo })); } catch {}
    }
  }, [tempo]);

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
          Speed: {tempo.toFixed(1)}x
          <input
            min="0.8" max="2.0" step="0.1" type="range"
            value={tempo}
            onChange={(e)=>setTempo(parseFloat(e.target.value))}
          />
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
