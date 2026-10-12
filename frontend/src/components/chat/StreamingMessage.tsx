import React from 'react';

interface StreamingMessageProps {
  text: string;
  isStreaming?: boolean;
}

export function StreamingMessage({ text, isStreaming }: StreamingMessageProps) {
  return (
    <div className="streaming-message-container" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
      {text}
      {isStreaming && (
        <span
          className="streaming-cursor"
          style={{
            display: 'inline-block',
            width: '8px',
            height: '15px',
            marginLeft: '4px',
            backgroundColor: 'var(--primary)',
            verticalAlign: 'middle',
            animation: 'blink 0.8s infinite',
          }}
        />
      )}
    </div>
  );
}
