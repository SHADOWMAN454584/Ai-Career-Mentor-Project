import React, { useEffect, useRef, useState } from 'react';
import { Lightbulb, Send, Bot, User, Square } from 'lucide-react';
import { ChatMessage } from '../../types/api';
import { streamMentorChat } from '../../lib/api';
import { StreamingMessage } from './StreamingMessage';

interface MentorChatProps {
  targetRole: string;
}

function createWelcomeMessage(targetRole: string): ChatMessage {
  return {
    id: 'welcome',
    sender: 'mentor',
    text: `Hello! I'm your AI Career Mentor for **${targetRole}**. How can I help you prepare for campus placements, project reviews, or technical interviews today?`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export function MentorChat({ targetRole }: MentorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createWelcomeMessage(targetRole)]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [resumeContextUsed, setResumeContextUsed] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  useEffect(() => {
    return () => {
      abortRef.current?.();
    };
  }, []);

  useEffect(() => {
    abortRef.current?.();
    abortRef.current = null;
    setIsStreaming(false);
    setInput('');
    setResumeContextUsed(null);
    setMessages([createWelcomeMessage(targetRole)]);
  }, [targetRole]);

  const quickPrompts = [
    `How do I stand out for ${targetRole} campus placements?`,
    'What are my biggest skill gaps right now?',
    'How should I explain complex technical projects using STAR?',
    'What should I prioritize if I have 4 weeks before interviews?',
  ];

  function handleSend(textToSend?: string) {
    const query = (textToSend || input).trim();
    if (!query || isStreaming) return;

    const history = messages
      .filter((msg) => msg.id !== 'welcome' && msg.text.trim())
      .slice(-8)
      .map((msg) => ({
        role: (msg.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: msg.text,
      }));

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
    abortRef.current = streamMentorChat(
      { message: query, target_role: targetRole, history },
      (chunk) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === mentorMsgId ? { ...msg, text: msg.text + chunk } : msg
          )
        );
      },
      () => {
        abortRef.current = null;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === mentorMsgId ? { ...msg, isStreaming: false } : msg
          )
        );
        setIsStreaming(false);
      },
      (err) => {
        abortRef.current = null;
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
      },
      (meta) => setResumeContextUsed(Boolean(meta.resume_context))
    );
  }

  function stopStreaming() {
    abortRef.current?.();
    abortRef.current = null;
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
    );
  }

  return (
    <section className="mentor-chat-card" style={{ display: 'grid', gap: '20px' }}>
      <div className="section-intro">
        <div>
          <p className="overline">Real-Time Mentorship</p>
          <h2>Interactive AI Guidance for {targetRole}</h2>
        </div>
        <div>
          <p className="muted">
            Ask questions about interview strategies, project portfolio structuring, and skill gaps.
          </p>
          {resumeContextUsed !== null && (
            <p className={`chat-context-badge${resumeContextUsed ? '' : ' is-warning'}`}>
              {resumeContextUsed
                ? 'Grounded in your saved resume and analysis data.'
                : 'No resume data found yet — advice will be general.'}
            </p>
          )}
        </div>
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
        {isStreaming ? (
          <button
            className="secondary-button"
            type="button"
            onClick={stopStreaming}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Stop</span>
            <Square size={12} color="currentColor" aria-hidden="true" />
          </button>
        ) : (
          <button
            className="primary-button"
            type="submit"
            disabled={!input.trim()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Send</span>
            <Send size={14} color="currentColor" aria-hidden="true" />
          </button>
        )}
      </form>
    </section>
  );
}
