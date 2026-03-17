import React, { useEffect, useState } from 'react';
import { Chat, Message } from './components/Chat';
import { VocabTable } from './components/VocabTable';
import { generateQuestions, evaluateAnswers } from './lib/gemini';
import { BookOpen, RefreshCw, Download, Upload, Settings } from 'lucide-react';

type VocabItem = {
  word: string;
  meaning: string;
  level: string;
  remarks?: string;
  lastTestedRound: number;
};

export default function App() {
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('gemini-2.0-flash');
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

        if (savedMessages) setMessages(JSON.parse(savedMessages));
        if (savedRound) setCurrentRound(parseInt(savedRound, 10));
        if (savedModelName) setModelName(savedModelName);
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
    }
  }, [messages, currentRound, isLoading, apiKey, modelName]);

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
    const newVocab = [...vocab, { word, meaning, level, lastTestedRound: 0 }];
    setVocab(newVocab);
    await saveVocabToBackend(newVocab);
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
      const questionText = await generateQuestions(vocab, roundToUse, apiKey, modelName);
      if (currentGenId !== generationIdRef.current) return;
      const newMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: questionText,
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
      const lastQuestion = [...messages].reverse().find((m) => m.isQuestion)?.content || '';

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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 font-sans text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">TOEIC Coach</h1>
            <p className="text-xs font-medium text-gray-500">Dynamic Risk Management Mode</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <a
            href="/api/vocab/download"
            className="flex items-center space-x-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 shadow-sm"
          >
            <Download className="h-4 w-4" />
            <span>Download Excel</span>
          </a>
          <div className="flex items-center space-x-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600">
            <span>Round</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-indigo-600 shadow-sm">
              {currentRound}
            </span>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Reset Chat</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 shadow-sm"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden p-6 gap-6">
        <div className="flex w-1/2 flex-col">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Training Session</h2>
          </div>
          <div className="flex-1 overflow-hidden">
            <Chat
              messages={messages}
              isGenerating={isGenerating}
              onSendMessage={handleSendMessage}
              onNextRound={handleNextRound}
            />
          </div>
        </div>

        <div className="flex w-1/2 flex-col">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Vocabulary Database</h2>
            <div className="flex space-x-2">
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                🟢 O: {vocab.filter((v) => v.level === 'O').length}
              </span>
              <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                🟡 ^: {vocab.filter((v) => v.level === '^').length}
              </span>
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                🔴 X: {vocab.filter((v) => v.level === 'X').length}
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="h-full pr-2">
              <VocabTable 
                vocab={vocab} 
                currentRound={currentRound}
                onAddWord={handleAddWord}
                onDeleteWord={handleDeleteWord}
              />
            </div>
          </div>
        </div>
      </main>

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Reset Chat History</h3>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to reset the chat history? This will start a new session from Round 1. Your vocabulary progress will be kept.
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
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
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Settings</h3>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gemini API Key
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Gemini API key"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Your API key is stored locally in your browser.
                </p>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gemini Model
                </label>
                <select
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                  <option value="gemini-2.0-pro-exp-02-05">gemini-2.0-pro-exp-02-05</option>
                  <option value="gemini-3.1-flash-lite-preview">gemini-3.1-flash-lite-preview</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
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
      )}
    </div>
  );
}
