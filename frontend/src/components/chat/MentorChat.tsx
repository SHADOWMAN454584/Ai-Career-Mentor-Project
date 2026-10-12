import React, { useEffect, useRef, useState } from 'react';
import { Lightbulb, Send, Bot, User } from 'lucide-react';
import { ChatMessage } from '../../types/api';
import { streamMentorChat } from '../../lib/api';
import { StreamingMessage } from './StreamingMessage';

interface MentorChatProps {
  targetRole: string;
}

export function MentorChat({ targetRole }: MentorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'mentor',
      text: `Hello! I'm your AI Career Mentor for **${targetRole}**. How can I help you prepare for campus placements, project reviews, or technical interviews today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const quickPrompts = [
    `How do I stand out for ${targetRole} campus placements?`,
    'How should I explain complex technical projects using STAR?',
    'What should I prioritize if I have 4 weeks before interviews?',
  ];

  async function handleSend(textToSend?: string) {
    const query = (textToSend || input).trim();
    if (!query || isStreaming) return;

    setInput('');
    const userMsgId = `user-${Date.now()}`;
    const mentorMsgId = `mentor-${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: 'user', text: query, timestamp },
      { id: mentorMsgId, sender: 'mentor', text: '', timestamp, isStreaming: true },
    ]);

    setIsStreaming(true);

    await streamMentorChat(
      { message: query, target_role: targetRole },
      (chunk) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === mentorMsgId ? { ...msg, text: msg.text + chunk } : msg
          )
        );
      },
      () => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === mentorMsgId ? { ...msg, isStreaming: false } : msg
          )
        );
        setIsStreaming(false);
      },
      (err) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === mentorMsgId
              ? {
                  ...msg,
                  text: msg.text + `\n\n*(Error generating streaming response: ${err.message})*`,
                  isStreaming: false,
                }
              : msg
          )
        );
        setIsStreaming(false);
      }
    );
  }

  return (
    <section className="mentor-chat-card" style={{ display: 'grid', gap: '20px' }}>
      <div className="section-intro">
        <div>
          <p className="overline">Real-Time Mentorship</p>
          <h2>Interactive AI Guidance for {targetRole}</h2>
        </div>
        <p className="muted">
          Ask questions about interview strategies, project portfolio structuring, and skill gaps.
        </p>
      </div>

      <div
        className="chat-message-list"
        style={{
          maxHeight: '480px',
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          background: 'var(--surface-muted)',
          display: 'grid',
          gap: '16px',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '14px 18px',
                borderRadius: '14px',
                background: msg.sender === 'user' ? 'var(--primary)' : 'var(--surface-raised)',
                color: msg.sender === 'user' ? '#1a1a1a' : 'var(--text-main)',
                boxShadow: 'var(--shadow-soft)',
                border: msg.sender === 'user' ? 'none' : '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  opacity: 0.75,
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {msg.sender === 'user' ? (
                  <User size={12} color="currentColor" aria-hidden="true" />
                ) : (
                  <Bot size={12} color="currentColor" aria-hidden="true" />
                )}
                <span>
                  {msg.sender === 'user' ? 'You' : 'Campus2Career Mentor'} • {msg.timestamp}
                </span>
              </div>
              <StreamingMessage text={msg.text} isStreaming={msg.isStreaming} />
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="text-button"
            style={{
              fontSize: '11px',
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            disabled={isStreaming}
            onClick={() => handleSend(prompt)}
          >
            <Lightbulb size={12} color="currentColor" aria-hidden="true" />
            <span>{prompt}</span>
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        style={{ display: 'flex', gap: '12px' }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about ${targetRole} prep, projects, or placement tips...`}
          disabled={isStreaming}
          style={{ flex: 1 }}
        />
        <button
          className="primary-button"
          type="submit"
          disabled={!input.trim() || isStreaming}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <span>{isStreaming ? 'Streaming...' : 'Send'}</span>
          <Send size={14} color="currentColor" aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
