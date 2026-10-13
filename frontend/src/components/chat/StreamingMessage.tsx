import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface StreamingMessageProps {
  text: string;
  isStreaming?: boolean;
}

export function StreamingMessage({ text, isStreaming }: StreamingMessageProps) {
  return (
    <div className="streaming-message-container" style={{ lineHeight: 1.65 }}>
      <div className="markdown-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
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
