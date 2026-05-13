import { useEffect, useRef, useState } from 'react';
import socket from '../services/socket';

export default function TranscriptionFeed({ classId, live = true }) {
  const [entries, setEntries] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!live) return;

    function handleTranscription(data) {
      if (data.class_id === classId) {
        setEntries(prev => [...prev, { content: data.content, timestamp: data.timestamp }]);
      }
    }

    socket.on('new_transcription', handleTranscription);
    return () => socket.off('new_transcription', handleTranscription);
  }, [classId, live]);

  useEffect(() => {
    if (bottomRef.current && live) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, live]);

  if (entries.length === 0) {
    return (
      <div className="py-4 text-center text-gray-500 text-sm">
        {live ? 'Aguardando transcrição...' : 'Sem transcrições disponíveis.'}
      </div>
    );
  }

  return (
    <div className="text-sm leading-relaxed">
      {entries.map((entry, i) => (
        <div key={i} className={`mb-3 pb-3 ${i < entries.length - 1 ? 'border-b border-gray-200' : ''}`}>
          {entry.timestamp && (
            <span className="text-xs text-gray-500 block mb-1">
              {new Date(entry.timestamp).toLocaleTimeString('pt-BR')}
            </span>
          )}
          <p className="m-0 text-gray-900">{entry.content}</p>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
