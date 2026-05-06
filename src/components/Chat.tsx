import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { Send, Loader2, RefreshCw } from 'lucide-react';
import type { GeneratedQuestion } from '../lib/gemini';

export type Message = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  questions?: GeneratedQuestion[];
  isQuestion?: boolean;
};

interface ChatProps {
  messages: Message[];
  isGenerating: boolean;
  onSendMessage: (message: string) => void;
  onNextRound: () => void;
  isDarkReadingMode?: boolean;
}

function StructuredQuestions({
  questions,
  isDarkReadingMode = false,
}: {
  questions: GeneratedQuestion[];
  isDarkReadingMode?: boolean;
}) {
  return (
    <div className="space-y-5">
      {questions.map((question, index) => {
        const number = question.number || index + 1;
        const choices = [
          ['A', question.choices.A],
          ['B', question.choices.B],
          ['C', question.choices.C],
          ['D', question.choices.D],
        ] as const;

        return (
          <section key={`${number}-${question.targetWord || index}`} className="space-y-3">
            <p className={`m-0 text-sm leading-6 ${isDarkReadingMode ? 'text-slate-100' : 'text-gray-900'}`}>
              <span className="font-semibold">{number}. </span>
              {question.stem}
            </p>
            <div className="space-y-2">
              {choices.map(([label, text]) => (
                <div key={label} className={`flex items-start gap-2 text-sm leading-5 ${isDarkReadingMode ? 'text-slate-200' : 'text-gray-800'}`}>
                  <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-semibold ${isDarkReadingMode ? 'border-slate-600 bg-slate-950 text-slate-300' : 'border-gray-300 bg-white text-gray-600'}`}>
                    {label}
                  </span>
                  <span className="min-w-0 break-words">{text}</span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function Chat({
  messages,
  isGenerating,
  onSendMessage,
  onNextRound,
  isDarkReadingMode = false,
}: ChatProps) {
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
    <div className={`flex h-full flex-col rounded-2xl border shadow-sm overflow-hidden transition-colors ${isDarkReadingMode ? 'border-slate-800 bg-slate-900' : 'border-gray-200 bg-white'}`}>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && !isGenerating && (
          <div className={`flex h-full items-center justify-center ${isDarkReadingMode ? 'text-slate-400' : 'text-gray-500'}`}>
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
                  : isDarkReadingMode
                    ? 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-none'
                    : 'bg-gray-50 text-gray-800 border border-gray-100 rounded-bl-none'
              }`}
            >
              <div className={`prose prose-sm max-w-none ${msg.role === 'user' || isDarkReadingMode ? 'prose-invert' : ''}`}>
                {msg.role === 'assistant' && msg.isQuestion && msg.questions?.length ? (
                  <StructuredQuestions questions={msg.questions} isDarkReadingMode={isDarkReadingMode} />
                ) : (
                  <Markdown remarkPlugins={[remarkBreaks]}>{msg.content}</Markdown>
                )}
              </div>
            </div>
          </div>
        ))}
        {isGenerating && (
          <div className="flex justify-start">
            <div className={`max-w-[85%] rounded-2xl rounded-bl-none px-5 py-3.5 border shadow-sm ${isDarkReadingMode ? 'border-slate-700 bg-slate-800' : 'border-gray-100 bg-gray-50'}`}>
              <div className={`flex items-center space-x-2 ${isDarkReadingMode ? 'text-slate-400' : 'text-gray-500'}`}>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">Coach is thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={`border-t p-4 ${isDarkReadingMode ? 'border-slate-800 bg-slate-950/40' : 'border-gray-100 bg-gray-50/50'}`}>
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
              className={`flex-1 rounded-xl border px-4 py-3 text-sm shadow-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${isDarkReadingMode ? 'border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 disabled:bg-slate-800 disabled:text-slate-500' : 'border-gray-200 bg-white disabled:bg-gray-100 disabled:text-gray-400'}`}
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
