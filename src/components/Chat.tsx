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
  onRetry: () => void;
  hasRetryAction: boolean;
  retryAttemptCount: number;
  canRetryManually: boolean;
  isDarkReadingMode?: boolean;
}

type StemToken = {
  text: string;
  type: 'word' | 'text';
  wordIndex?: number;
};

type WordReference = {
  questionNumber: number;
  word: string;
  wordIndex: number;
};

const CHOICE_PATTERN = /(?:^|[,\s])(\d+)\s*\.\s*([A-D])(?=$|[,\s])/gi;
const WORD_PATTERN = /[A-Za-z]+(?:[-'][A-Za-z]+)*/g;

export function getSelectedChoices(input: string): Record<number, string> {
  const selections: Record<number, string> = {};

  for (const match of input.matchAll(CHOICE_PATTERN)) {
    selections[Number(match[1])] = match[2].toUpperCase();
  }

  return selections;
}

function withoutChoiceSelections(input: string) {
  return input
    .replace(CHOICE_PATTERN, ' ')
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s*\|\s*/g, ' | ')
    .replace(/\s+/g, ' ')
    .replace(/^\s*[|,]\s*|\s*[|,]\s*$/g, '')
    .trim();
}

export function selectQuestionChoice(input: string, questionNumber: number, choice: string): string {
  const selections = getSelectedChoices(input);
  selections[questionNumber] = choice.toUpperCase();
  const existingText = withoutChoiceSelections(input);

  const choiceText = Object.entries(selections)
    .map(([number, selectedChoice]) => [Number(number), selectedChoice] as const)
    .sort(([left], [right]) => left - right)
    .map(([number, selectedChoice]) => `${number}. ${selectedChoice}`)
    .join(', ');

  return [existingText, choiceText].filter(Boolean).join(' | ');
}

export function splitQuestionStemIntoTokens(stem: string): StemToken[] {
  const tokens: StemToken[] = [];
  let lastIndex = 0;
  let wordIndex = 0;

  for (const match of stem.matchAll(WORD_PATTERN)) {
    const start = match.index ?? 0;
    const text = match[0];

    if (start > lastIndex) {
      tokens.push({ text: stem.slice(lastIndex, start), type: 'text' });
    }

    wordIndex += 1;
    tokens.push({ text, type: 'word', wordIndex });
    lastIndex = start + text.length;
  }

  if (lastIndex < stem.length) {
    tokens.push({ text: stem.slice(lastIndex), type: 'text' });
  }

  return tokens;
}

export function appendQuestionWordReference(input: string, reference: WordReference): string {
  const wordReference = `問題 ${reference.questionNumber}，第 ${reference.wordIndex} 個單字「${reference.word}」：`;
  const trimmedInput = input.trim();

  if (!trimmedInput) return wordReference;
  if (trimmedInput.includes(wordReference)) return trimmedInput;

  return `${trimmedInput} | ${wordReference}`;
}

function StructuredQuestions({
  questions,
  selectedChoices,
  onSelectChoice,
  onSelectWord,
  canSelect,
  isDarkReadingMode = false,
}: {
  questions: GeneratedQuestion[];
  selectedChoices: Record<number, string>;
  onSelectChoice: (questionNumber: number, choice: string) => void;
  onSelectWord: (reference: WordReference) => void;
  canSelect: boolean;
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
              {splitQuestionStemIntoTokens(question.stem).map((token, tokenIndex) => {
                if (token.type === 'text') {
                  return <React.Fragment key={`${token.text}-${tokenIndex}`}>{token.text}</React.Fragment>;
                }

                return (
                  <button
                    key={`${token.text}-${token.wordIndex}-${tokenIndex}`}
                    type="button"
                    onClick={() => onSelectWord({
                      questionNumber: number,
                      word: token.text,
                      wordIndex: token.wordIndex ?? 0,
                    })}
                    disabled={!canSelect}
                    className={`inline rounded px-0.5 text-left transition-colors disabled:cursor-not-allowed ${
                      isDarkReadingMode
                        ? 'hover:bg-slate-700 hover:text-indigo-200 focus:bg-slate-700 focus:text-indigo-200'
                        : 'hover:bg-indigo-50 hover:text-indigo-700 focus:bg-indigo-50 focus:text-indigo-700'
                    } focus:outline-none focus:ring-1 focus:ring-indigo-400`}
                    title={`問題 ${number}，第 ${token.wordIndex} 個單字`}
                  >
                    {token.text}
                  </button>
                );
              })}
            </p>
            <div className="space-y-2">
              {choices.map(([label, text]) => {
                const isSelected = selectedChoices[number] === label;

                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onSelectChoice(number, label)}
                    disabled={!canSelect}
                    aria-pressed={isSelected}
                    className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-sm leading-5 transition-colors disabled:cursor-not-allowed ${
                      isSelected
                        ? isDarkReadingMode
                          ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100'
                          : 'border-indigo-500 bg-indigo-50 text-indigo-900'
                        : isDarkReadingMode
                          ? 'border-transparent text-slate-200 hover:border-slate-600 hover:bg-slate-700/60'
                          : 'border-transparent text-gray-800 hover:border-gray-200 hover:bg-white'
                    }`}
                  >
                    <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-semibold ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : isDarkReadingMode
                          ? 'border-slate-600 bg-slate-950 text-slate-300'
                          : 'border-gray-300 bg-white text-gray-600'
                    }`}>
                      {label}
                    </span>
                    <span className="min-w-0 break-words">{text}</span>
                  </button>
                );
              })}
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
  onRetry,
  hasRetryAction,
  retryAttemptCount,
  canRetryManually,
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
  const isWaitingForNextRound = !hasRetryAction && lastMessage?.role === 'assistant' && !lastMessage?.isQuestion && messages.length > 0;
  const selectedChoices = getSelectedChoices(input);

  const handleChoiceSelect = (questionNumber: number, choice: string) => {
    if (!isWaitingForAnswer || isGenerating) return;
    setInput((currentInput) => selectQuestionChoice(currentInput, questionNumber, choice));
  };

  const handleWordSelect = (reference: WordReference) => {
    if (!isWaitingForAnswer || isGenerating) return;
    setInput((currentInput) => appendQuestionWordReference(currentInput, reference));
  };

  return (
    <div className={`flex h-full flex-col rounded-2xl border shadow-sm overflow-hidden transition-colors ${isDarkReadingMode ? 'border-slate-800 bg-slate-900' : 'border-gray-200 bg-white'}`}>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && !isGenerating && (
          <div className={`flex h-full items-center justify-center ${isDarkReadingMode ? 'text-slate-400' : 'text-gray-500'}`}>
            <p>Initializing TOEIC Coach...</p>
          </div>
        )}
        {messages.map((msg) => {
          const isActiveQuestion = msg.id === lastMessage?.id && isWaitingForAnswer;

          return (
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
                  <StructuredQuestions
                    questions={msg.questions}
                    selectedChoices={isActiveQuestion ? selectedChoices : {}}
                    onSelectChoice={handleChoiceSelect}
                    onSelectWord={handleWordSelect}
                    canSelect={isActiveQuestion && !isGenerating}
                    isDarkReadingMode={isDarkReadingMode}
                  />
                ) : (
                  <Markdown remarkPlugins={[remarkBreaks]}>{msg.content}</Markdown>
                )}
              </div>
            </div>
          </div>
          );
        })}
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
        {hasRetryAction ? (
          <div className="flex items-center gap-3">
            <div className={`flex-1 rounded-xl border px-4 py-3 text-center text-sm font-medium ${
              isDarkReadingMode
                ? 'border-slate-700 bg-slate-900 text-slate-300'
                : 'border-gray-200 bg-white text-gray-600'
            }`}>
              Attempted times: {retryAttemptCount}/10
            </div>
            {canRetryManually && (
              <button
                onClick={onRetry}
                disabled={isGenerating}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
                title="Retry"
                aria-label="Retry"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            )}
          </div>
        ) : isWaitingForNextRound ? (
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
              placeholder="任何單字問題，在這裡輸入"
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
