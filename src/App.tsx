import React, { useEffect, useState } from 'react';
import { Chat, Message } from './components/Chat';
import { VocabTable } from './components/VocabTable';
import { generateQuestions, evaluateAnswers, formatQuestionsForMarkdown, type SuggestedVocabularyAddition } from './lib/gemini';
import { DARK_READING_MODE_STORAGE_KEY, parseDarkReadingModePreference } from './lib/readingMode';
import { BookOpen, RefreshCw, Download, Settings, PanelRightClose, PanelRightOpen, Moon, Sun, Check, X } from 'lucide-react';

type VocabItem = {
  word: string;
  meaning: string;
  level: string;
  remarks?: string;
  lastTestedRound: number;
};

const AVAILABLE_MODELS = ['gemini-3.1-flash-lite-preview'];
const DEFAULT_MODEL_NAME = AVAILABLE_MODELS[0];

export default function App() {
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState(DEFAULT_MODEL_NAME);
  const [isVocabPanelCollapsed, setIsVocabPanelCollapsed] = useState(false);
  const [isDarkReadingMode, setIsDarkReadingMode] = useState(false);
  const [pendingVocabularySuggestions, setPendingVocabularySuggestions] = useState<SuggestedVocabularyAddition[]>([]);
  const generationIdRef = React.useRef(0);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch('/api/vocab');
        const data = await res.json();
        if (Array.isArray(data)) {
          setVocab(data);
        } else {
          console.error('Failed to load vocab, expected array but got:', data);
          setVocab([]);
        }

        const savedMessages = localStorage.getItem('toeic_chat_messages');
        const savedRound = localStorage.getItem('toeic_current_round');
        const savedApiKey = localStorage.getItem('gemini_api_key');
        const savedModelName = localStorage.getItem('gemini_model_name');
        const savedDarkReadingMode = localStorage.getItem(DARK_READING_MODE_STORAGE_KEY);

        if (savedMessages) setMessages(JSON.parse(savedMessages));
        if (savedRound) setCurrentRound(parseInt(savedRound, 10));
        setIsDarkReadingMode(parseDarkReadingModePreference(savedDarkReadingMode));
        if (savedModelName && AVAILABLE_MODELS.includes(savedModelName)) {
          setModelName(savedModelName);
        } else {
          setModelName(DEFAULT_MODEL_NAME);
        }
        if (savedApiKey) {
          setApiKey(savedApiKey);
        } else if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
          setApiKey(process.env.GEMINI_API_KEY);
        }
      } catch (error) {
        console.error('Failed to load vocab:', error);
        setVocab([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Save state to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('toeic_chat_messages', JSON.stringify(messages));
      localStorage.setItem('toeic_current_round', currentRound.toString());
      localStorage.setItem('gemini_api_key', apiKey);
      localStorage.setItem('gemini_model_name', modelName);
      localStorage.setItem(DARK_READING_MODE_STORAGE_KEY, String(isDarkReadingMode));
    }
  }, [messages, currentRound, isLoading, apiKey, modelName, isDarkReadingMode]);

  // Handle initial question generation or empty state
  useEffect(() => {
    if (!isLoading && messages.length === 0 && !isGenerating) {
      if (vocab.length > 0) {
        handleGenerateQuestions();
      } else {
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: '請輸入單字',
          isQuestion: false,
        }]);
      }
    }
  }, [isLoading, messages.length, vocab.length, isGenerating]);

  const handleAddWord = async (word: string, meaning: string, level: string) => {
    const cleanWord = word.trim();
    if (!cleanWord || vocab.some((v) => v.word.trim().toLowerCase() === cleanWord.toLowerCase())) return;

    const newVocab = [...vocab, { word: cleanWord, meaning: meaning.trim(), level, lastTestedRound: 0 }];
    setVocab(newVocab);
    await saveVocabToBackend(newVocab);
  };

  const enqueueVocabularySuggestions = (
    suggestions: SuggestedVocabularyAddition[] | undefined,
    currentVocab: VocabItem[]
  ) => {
    if (!suggestions?.length) return;

    setPendingVocabularySuggestions((current) => {
      const knownWords = new Set([
        ...currentVocab.map((item) => item.word.trim().toLowerCase()),
        ...current.map((item) => item.word.trim().toLowerCase()),
      ]);
      const additions = suggestions.filter((suggestion) => {
        const key = suggestion.word.trim().toLowerCase();
        if (!key || knownWords.has(key)) return false;
        knownWords.add(key);
        return true;
      });

      return [...current, ...additions];
    });
  };

  const handleAcceptVocabularySuggestion = async () => {
    const suggestion = pendingVocabularySuggestions[0];
    if (!suggestion) return;

    await handleAddWord(suggestion.word, suggestion.meaning, suggestion.level);
    setPendingVocabularySuggestions((current) => current.slice(1));
  };

  const handleRejectVocabularySuggestion = () => {
    setPendingVocabularySuggestions((current) => current.slice(1));
  };

  const handleDeleteWord = async (wordToDelete: string) => {
    const newVocab = vocab.filter((v) => v.word !== wordToDelete);
    setVocab(newVocab);
    await saveVocabToBackend(newVocab);
  };

  const saveVocabToBackend = async (newVocab: VocabItem[]) => {
    try {
      await fetch('/api/vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVocab),
      });
    } catch (error) {
      console.error('Failed to save vocab:', error);
    }
  };

  const handleGenerateQuestions = async (roundOverride?: number) => {
    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: '請進入設定填入LLM的API',
          isQuestion: false,
        },
      ]);
      return;
    }
    if (vocab.length === 0) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: '請輸入單字',
          isQuestion: false,
        },
      ]);
      return;
    }
    setIsGenerating(true);
    const currentGenId = ++generationIdRef.current;
    const roundToUse = roundOverride ?? currentRound;
    try {
      const questionPayload = await generateQuestions(vocab, roundToUse, apiKey, modelName);
      if (currentGenId !== generationIdRef.current) return;
      const newMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: questionPayload.message,
        questions: questionPayload.questions,
        isQuestion: true,
      };
      setMessages((prev) => [...prev, newMessage]);
    } catch (error) {
      if (currentGenId !== generationIdRef.current) return;
      console.error('Failed to generate questions:', error);

      let errorMessage = 'Sorry, I encountered an error generating questions. Please try again.';
      if (error?.status === 429) {
        errorMessage = '⚠️ API 額度已耗盡 (Quota Exceeded)。請稍後再試，或更換其他模型的 API Key。';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: errorMessage,
          isQuestion: false,
        },
      ]);
    } finally {
      if (currentGenId === generationIdRef.current) {
        setIsGenerating(false);
      }
    }
  };

  const handleSendMessage = async (userAnswer: string) => {
    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: '請進入設定填入LLM的API',
          isQuestion: false,
        },
      ]);
      return;
    }
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userAnswer,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);
    const currentGenId = ++generationIdRef.current;

    try {
      // Find the last question
      const lastQuestionMessage = [...messages].reverse().find((m) => m.isQuestion);
      const lastQuestion = lastQuestionMessage?.questions?.length
        ? formatQuestionsForMarkdown(lastQuestionMessage.questions)
        : lastQuestionMessage?.content || '';

      const result = await evaluateAnswers(lastQuestion, userAnswer, vocab, currentRound, apiKey, modelName);
      if (currentGenId !== generationIdRef.current) return;

      // Update vocab
      let updatedVocab = [...vocab];

      // Update tested words cooldown
      if (result.testedWords && Array.isArray(result.testedWords)) {
        updatedVocab = updatedVocab.map((v) => {
          const isTested = result.testedWords.some(
            (tw: string) => tw.toLowerCase() === v.word.toLowerCase()
          );
          if (isTested) {
            return { ...v, lastTestedRound: currentRound };
          }
          return v;
        });
      }

      // Update levels
      if (result.updates && Array.isArray(result.updates)) {
        result.updates.forEach((update: any) => {
          if (!update.word || !update.newLevel) return;

          // 1. Try to clean the word by extracting just the alphabetical prefix
          let cleanWord = update.word.toLowerCase().trim();
          const match = update.word.match(/([a-zA-Z\s]+)/);
          if (match) {
            cleanWord = match[1].trim().toLowerCase();
          }

          // 2. Try exact match first
          let index = updatedVocab.findIndex(
            (v) => v.word.trim().toLowerCase() === cleanWord
          );

          // 3. Fallback: If no exact match, try to see if any vocab word is practically identical
          // Gemini sometimes hallucinates slightly different spellings or includes the base word inside a larger string.
          if (index === -1) {
            index = updatedVocab.findIndex((v) => {
              const vWord = v.word.trim().toLowerCase();
              return cleanWord.includes(vWord) || vWord.includes(cleanWord);
            });
          }
          if (index !== -1) {
            const oldLevel = updatedVocab[index].level;
            const newLevel = update.newLevel;
            if (['O', '^', 'X'].includes(newLevel) && oldLevel !== newLevel) {
              updatedVocab[index] = {
                ...updatedVocab[index],
                level: newLevel,
                remarks: `從 ${oldLevel} 區移動到 ${newLevel} 區`
              };
            }
          }
        });
      }

      setVocab(updatedVocab);
      await saveVocabToBackend(updatedVocab);
      enqueueVocabularySuggestions(result.suggestedAdditions, updatedVocab);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.message,
        isQuestion: false,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      if (currentGenId !== generationIdRef.current) return;
      console.error('Failed to evaluate answers:', error);

      let errorMessage = 'Sorry, I encountered an error evaluating your answer. Please try again.';
      if (error?.status === 429) {
        errorMessage = '⚠️ API 額度已耗盡 (Quota Exceeded)。請稍後再試，或更換其他模型的 API Key。';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: errorMessage,
          isQuestion: false,
        },
      ]);
    } finally {
      if (currentGenId === generationIdRef.current) {
        setIsGenerating(false);
      }
    }
  };

  const handleNextRound = () => {
    const nextRound = currentRound + 1;
    setCurrentRound(nextRound);
    handleGenerateQuestions(nextRound);
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    generationIdRef.current++;
    setMessages([]);
    setCurrentRound(1);
    setIsGenerating(false);
    localStorage.removeItem('toeic_chat_messages');
    localStorage.removeItem('toeic_current_round');
    setShowResetConfirm(false);
  };

  const currentVocabularySuggestion = pendingVocabularySuggestions[0];

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen flex-col font-sans transition-colors ${isDarkReadingMode ? 'bg-slate-950 text-slate-100' : 'bg-gray-50 text-gray-900'}`}>
      <header className={`flex items-center justify-between border-b px-6 py-4 shadow-sm transition-colors ${isDarkReadingMode ? 'border-slate-800 bg-slate-900' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center space-x-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isDarkReadingMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className={`text-xl font-bold tracking-tight ${isDarkReadingMode ? 'text-slate-50' : 'text-gray-900'}`}>TOEIC Coach</h1>
            <p className={`text-xs font-medium ${isDarkReadingMode ? 'text-slate-400' : 'text-gray-500'}`}>Dynamic Risk Management Mode</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <a
            href="/api/vocab/download"
            className={`flex items-center space-x-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors shadow-sm ${isDarkReadingMode ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20' : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'}`}
          >
            <Download className="h-4 w-4" />
            <span>Download Excel</span>
          </a>
          <div className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-sm font-medium ${isDarkReadingMode ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>
            <span>Round</span>
            <span className={`flex h-6 w-6 items-center justify-center rounded-md shadow-sm ${isDarkReadingMode ? 'bg-slate-700 text-indigo-200' : 'bg-white text-indigo-600'}`}>
              {currentRound}
            </span>
          </div>
          <button
            onClick={() => setIsDarkReadingMode((current) => !current)}
            aria-pressed={isDarkReadingMode}
            className={`flex items-center space-x-2 rounded-lg border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors ${isDarkReadingMode ? 'border-amber-400/30 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
            title={isDarkReadingMode ? 'Switch to light reading mode' : 'Switch to dark reading mode'}
          >
            {isDarkReadingMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{isDarkReadingMode ? 'Light Read' : 'Dark Read'}</span>
          </button>
          <button
            onClick={handleReset}
            className={`flex items-center space-x-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors shadow-sm ${isDarkReadingMode ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-50' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <RefreshCw className="h-4 w-4" />
            <span>Reset Chat</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors shadow-sm ${isDarkReadingMode ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-50' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden p-6 gap-6">
        <div className={`flex min-w-0 flex-col transition-all duration-200 ${isVocabPanelCollapsed ? 'w-full' : 'w-1/2'}`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className={`text-lg font-semibold ${isDarkReadingMode ? 'text-slate-100' : 'text-gray-800'}`}>Training Session</h2>
            {isVocabPanelCollapsed && (
              <button
                onClick={() => setIsVocabPanelCollapsed(false)}
                className={`flex items-center space-x-2 rounded-lg border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors ${isDarkReadingMode ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-50' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                title="Show vocabulary database"
              >
                <PanelRightOpen className="h-4 w-4" />
                <span>Show Vocabulary</span>
              </button>
            )}
          </div>
          <div className="relative flex-1 overflow-hidden">
            <Chat
              messages={messages}
              isGenerating={isGenerating}
              onSendMessage={handleSendMessage}
              onNextRound={handleNextRound}
              isDarkReadingMode={isDarkReadingMode}
            />
            {currentVocabularySuggestion && (
              <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex justify-center">
                <div className={`pointer-events-auto w-full max-w-md rounded-xl border p-4 shadow-2xl backdrop-blur ${isDarkReadingMode ? 'border-slate-700 bg-slate-900/95 text-slate-100' : 'border-indigo-100 bg-white/95 text-gray-900'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold uppercase tracking-wide ${isDarkReadingMode ? 'text-indigo-300' : 'text-indigo-600'}`}>
                        AI 建議新增單字
                      </p>
                      <h3 className={`mt-1 break-words text-lg font-bold ${isDarkReadingMode ? 'text-slate-50' : 'text-gray-950'}`}>
                        {currentVocabularySuggestion.word}
                      </h3>
                    </div>
                    <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${currentVocabularySuggestion.level === 'X'
                      ? isDarkReadingMode ? 'border-rose-500/40 bg-rose-500/15 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-700'
                      : currentVocabularySuggestion.level === '^'
                        ? isDarkReadingMode ? 'border-amber-500/40 bg-amber-500/15 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-700'
                        : isDarkReadingMode ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      }`}>
                      {currentVocabularySuggestion.level}
                    </span>
                  </div>
                  <p className={`mt-2 break-words text-sm ${isDarkReadingMode ? 'text-slate-300' : 'text-gray-600'}`}>
                    {currentVocabularySuggestion.meaning}
                  </p>
                  <p className={`mt-2 text-xs ${isDarkReadingMode ? 'text-slate-400' : 'text-gray-500'}`}>
                    要加入到 Vocabulary Database 嗎？{pendingVocabularySuggestions.length > 1 ? `還有 ${pendingVocabularySuggestions.length - 1} 個建議等待確認。` : ''}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={handleRejectVocabularySuggestion}
                      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${isDarkReadingMode ? 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      <X className="h-4 w-4" />
                      <span>否</span>
                    </button>
                    <button
                      onClick={handleAcceptVocabularySuggestion}
                      className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                    >
                      <Check className="h-4 w-4" />
                      <span>是，加入</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {!isVocabPanelCollapsed && (
          <div className="flex min-w-0 w-1/2 flex-col transition-all duration-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className={`text-lg font-semibold ${isDarkReadingMode ? 'text-slate-100' : 'text-gray-800'}`}>Vocabulary Database</h2>
              <div className="flex flex-wrap items-center justify-end gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isDarkReadingMode ? 'bg-emerald-500/15 text-emerald-200' : 'bg-green-100 text-green-800'}`}>
                🟢 O: {vocab.filter((v) => v.level === 'O').length}
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isDarkReadingMode ? 'bg-amber-500/15 text-amber-200' : 'bg-yellow-100 text-yellow-800'}`}>
                🟡 ^: {vocab.filter((v) => v.level === '^').length}
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isDarkReadingMode ? 'bg-rose-500/15 text-rose-200' : 'bg-red-100 text-red-800'}`}>
                🔴 X: {vocab.filter((v) => v.level === 'X').length}
              </span>
              <button
                onClick={() => setIsVocabPanelCollapsed(true)}
                className={`flex shrink-0 items-center space-x-2 rounded-lg border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors ${isDarkReadingMode ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-50' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                title="Hide vocabulary database"
              >
                <PanelRightClose className="h-4 w-4" />
                <span>Hide</span>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="h-full pr-2">
              <VocabTable
                vocab={vocab}
                currentRound={currentRound}
                onAddWord={handleAddWord}
                onDeleteWord={handleDeleteWord}
                isDarkReadingMode={isDarkReadingMode}
              />
            </div>
          </div>
          </div>
        )}
      </main>

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-xl ${isDarkReadingMode ? 'bg-slate-900 text-slate-100' : 'bg-white'}`}>
            <h3 className={`text-lg font-bold ${isDarkReadingMode ? 'text-slate-50' : 'text-gray-900'}`}>Reset Chat History</h3>
            <p className={`mt-2 text-sm ${isDarkReadingMode ? 'text-slate-400' : 'text-gray-500'}`}>
              Are you sure you want to reset the chat history? This will start a new session from Round 1. Your vocabulary progress will be kept.
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${isDarkReadingMode ? 'text-slate-300 hover:bg-slate-800' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-xl ${isDarkReadingMode ? 'bg-slate-900 text-slate-100' : 'bg-white'}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className={`text-lg font-bold ${isDarkReadingMode ? 'text-slate-50' : 'text-gray-900'}`}>Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className={isDarkReadingMode ? 'text-slate-500 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkReadingMode ? 'text-slate-200' : 'text-gray-700'}`}>
                  Gemini API Key{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-500 hover:text-indigo-700 text-xs font-normal underline"
                  >
                    Get API Key
                  </a>
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Gemini API key"
                  className={`w-full rounded-xl border px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${isDarkReadingMode ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500' : 'border-gray-200 bg-white'}`}
                />
                <p className={`mt-1 text-xs ${isDarkReadingMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  Your API key is stored locally in your browser.
                </p>
              </div>
              <div className="mt-4">
                <label className={`block text-sm font-medium mb-1 ${isDarkReadingMode ? 'text-slate-200' : 'text-gray-700'}`}>
                  Gemini Model
                </label>
                <select
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className={`w-full rounded-xl border px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${isDarkReadingMode ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-gray-200 bg-white'}`}
                >
                  {AVAILABLE_MODELS.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
                <p className={`mt-1 text-xs ${isDarkReadingMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  Select which model variant to use.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-xl bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )
      }
    </div >
  );
}
