import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { Send, Loader2, RefreshCw } from 'lucide-react';

export type Message = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  isQuestion?: boolean;
};

interface ChatProps {
  messages: Message[];
  isGenerating: boolean;
  onSendMessage: (message: string) => void;
  onNextRound: () => void;
}

export function Chat({ messages, isGenerating, onSendMessage, onNextRound }: ChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    onSendMessage(input);
    setInput('');
  };

  const lastMessage = messages[messages.length - 1];
  const isWaitingForAnswer = lastMessage?.role === 'assistant' && lastMessage?.isQuestion;
  const isWaitingForNextRound = lastMessage?.role === 'assistant' && !lastMessage?.isQuestion && messages.length > 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && !isGenerating && (
          <div className="flex h-full items-center justify-center text-gray-500">
            <p>Initializing TOEIC Coach...</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-gray-50 text-gray-800 border border-gray-100 rounded-bl-none'
              }`}
            >
              <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : ''}`}>
                <Markdown remarkPlugins={[remarkBreaks]}>{msg.content}</Markdown>
              </div>
            </div>
          </div>
        ))}
        {isGenerating && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-none bg-gray-50 px-5 py-3.5 border border-gray-100 shadow-sm">
              <div className="flex items-center space-x-2 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">Coach is thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-100 bg-gray-50/50 p-4">
        {isWaitingForNextRound ? (
          <button
            onClick={onNextRound}
            disabled={isGenerating}
            className="flex w-full items-center justify-center space-x-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Start Next Round</span>
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!isWaitingForAnswer || isGenerating}
              placeholder={
                isWaitingForAnswer
                  ? "Type your answer (e.g., 1. A, 2. B)..."
                  : "Waiting for questions..."
              }
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-gray-100 disabled:text-gray-400 shadow-sm transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || !isWaitingForAnswer || isGenerating}
              className="flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-300 shadow-sm"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
