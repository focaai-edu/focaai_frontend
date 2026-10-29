import { useCallback, useEffect, useRef, useState } from 'react';
import socket from '../services/socket';

/**
 * useAudioChunks — gravação do áudio da aula, única para a tela do professor e
 * para a câmera da sala (RF14, #4).
 *
 * - Um MediaRecorder por trecho de CHUNK_MS: cada trecho é um WebM completo.
 * - `duration_ms` é o tempo real entre `recorder.start()` e o fim do trecho; o
 *   último, ao parar, é mais curto (o backend usa isso para datar a fala, RN15).
 * - Trechos com MIN_BYTES ou menos são descartados.
 * - Sem conexão, o trecho é descartado (sem fila do socket.io): o backend não
 *   aceita áudio fora da sala e a decisão do dono é não reenviar (RN25).
 * - Parar (`stop()`, `enabled=false` ou desmontar) finaliza e envia o trecho em
 *   curso antes de liberar o microfone.
 *
 * status: 'idle' | 'recording' | 'offline' | 'error' (microfone indisponível).
 */

const CHUNK_MS = 5000;
const MIN_BYTES = 500;

function sendChunk(classId, blob, durationMs, done) {
  if (blob.size <= MIN_BYTES || !socket.connected) { done(); return; }
  const reader = new FileReader();
  reader.onloadend = () => {
    const audio = typeof reader.result === 'string' ? reader.result.split(',')[1] : null;
    // Confere de novo: a conexão pode ter caído durante a leitura.
    if (audio && socket.connected) {
      socket.emit('audio_chunk', { class_id: classId, audio, duration_ms: durationMs });
    }
    done();
  };
  reader.readAsDataURL(blob);
}

export function useAudioChunks(classId, { enabled = true } = {}) {
  const [status, setStatus] = useState('idle');
  const sessionRef = useRef(null);

  const stop = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    session.finish();
    setStatus('idle');
  }, []);

  useEffect(() => {
    if (!enabled || classId == null) return undefined;
    let cancelled = false;
    let session = null;

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        const release = () => stream.getTracks().forEach((t) => t.stop());
        // A tela saiu (ou desligou) antes da permissão: não grava nada (F11).
        if (cancelled) { release(); return; }

        let recorder = null;
        let timer = null;
        let finishing = false;

        const startChunk = () => {
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm';
          const rec = new MediaRecorder(stream, { mimeType });
          const parts = [];
          let startedAt = 0;
          rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) parts.push(e.data); };
          rec.onstop = () => {
            clearTimeout(timer);
            const last = finishing;
            const blob = new Blob(parts, { type: 'audio/webm' });
            // A sessão pertence à aula com que começou: o último trecho vai para
            // ela mesmo se a tela já trocou ou limpou a aula selecionada.
            sendChunk(classId, blob, Math.round(Date.now() - startedAt), () => {
              if (last) release();
            });
            if (!last) startChunk();
          };
          rec.onerror = (e) => console.error('[audio] recorder error:', e);
          rec.start();
          startedAt = Date.now();
          recorder = rec;
          timer = setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, CHUNK_MS);
        };

        session = {
          finish() {
            finishing = true;
            clearTimeout(timer);
            if (recorder && recorder.state !== 'inactive') recorder.stop();
            else release();
          },
        };
        sessionRef.current = session;
        setStatus(socket.connected ? 'recording' : 'offline');
        startChunk();
      })
      .catch(() => { if (!cancelled) setStatus('error'); });

    const onConnect = () => setStatus((s) => (s === 'offline' ? 'recording' : s));
    const onDisconnect = () => setStatus((s) => (s === 'recording' ? 'offline' : s));
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      cancelled = true;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      if (session && sessionRef.current === session) {
        sessionRef.current = null;
        session.finish();
      }
      setStatus('idle');
    };
  }, [enabled, classId]);

  return { status, stop };
}
