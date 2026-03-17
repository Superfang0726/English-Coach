import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

type VocabItem = {
  word: string;
  meaning: string;
  level: string;
  remarks?: string;
  lastTestedRound: number;
};

interface VocabTableProps {
  vocab: VocabItem[];
  currentRound: number;
  onAddWord: (word: string, meaning: string, level: string) => void;
  onDeleteWord: (word: string) => void;
}

type SortField = 'level' | 'lastTestedRound' | null;
type SortDirection = 'asc' | 'desc';

export function VocabTable({ vocab, currentRound, onAddWord, onDeleteWord }: VocabTableProps) {
  const [newWord, setNewWord] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newLevel, setNewLevel] = useState('X');
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [errorMessage, setErrorMessage] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedWord = newWord.trim();
    const trimmedMeaning = newMeaning.trim();

    if (trimmedWord && trimmedMeaning) {
      const isDuplicate = vocab.some(
        (v) => v.word.toLowerCase() === trimmedWord.toLowerCase()
      );

      if (isDuplicate) {
        setErrorMessage('該單字已被輸入');
        setTimeout(() => setErrorMessage(''), 3000);
        return;
      }

      onAddWord(trimmedWord, trimmedMeaning, newLevel);
      setNewWord('');
      setNewMeaning('');
      setNewLevel('X');
      setErrorMessage('');
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedVocab = useMemo(() => {
    const sorted = [...vocab];
    if (!sortField) return sorted;

    sorted.sort((a, b) => {
      if (sortField === 'level') {
        const weight: Record<string, number> = { 'O': 3, '^': 2, 'X': 1 };
        const aWeight = weight[a.level] || 0;
        const bWeight = weight[b.level] || 0;
        return sortDirection === 'asc' ? aWeight - bWeight : bWeight - aWeight;
      }

      if (sortField === 'lastTestedRound') {
        return sortDirection === 'asc'
          ? a.lastTestedRound - b.lastTestedRound
          : b.lastTestedRound - a.lastTestedRound;
      }

      return 0;
    });

    return sorted;
  }, [vocab, sortField, sortDirection]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'O': return 'bg-green-100 text-green-800 border-green-200';
      case '^': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'X': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex flex-col gap-2">
        <form onSubmit={handleAdd} className="flex gap-2 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
          <input
            type="text"
            placeholder="Word"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            required
          />
          <input
            type="text"
            placeholder="Meaning"
            value={newMeaning}
            onChange={(e) => setNewMeaning(e.target.value)}
            className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            required
          />
          <select
            value={newLevel}
            onChange={(e) => setNewLevel(e.target.value)}
            className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
          >
            <option value="X">🔴 X 區</option>
            <option value="^">🟡 ^ 區</option>
            <option value="O">🟢 O 區</option>
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </button>
        </form>
        {errorMessage && (
          <div className="text-red-500 text-sm px-2 font-medium">
            {errorMessage}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-xs uppercase text-gray-700 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 font-medium">Word</th>
              <th className="px-6 py-3 font-medium">Meaning</th>
              <th 
                className="px-6 py-3 font-medium cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('level')}
              >
                <div className="flex items-center space-x-1">
                  <span>Level</span>
                  {renderSortIcon('level')}
                </div>
              </th>
              <th 
                className="px-6 py-3 font-medium cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('lastTestedRound')}
              >
                <div className="flex items-center space-x-1">
                  <span>Last Tested</span>
                  {renderSortIcon('lastTestedRound')}
                </div>
              </th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedVocab.map((item, index) => {
              const roundsSinceTested = currentRound - item.lastTestedRound;
              const isCoolingDown = item.lastTestedRound > 0 && roundsSinceTested < 3;
              const cooldownText = isCoolingDown ? `(Cooldown: ${3 - roundsSinceTested} rounds left)` : '(Ready)';

              return (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{item.word}</td>
                  <td className="px-6 py-4">{item.meaning}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${getLevelColor(item.level)}`}>
                      {item.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    <div>Round {item.lastTestedRound}</div>
                    <div className={`text-xs ${isCoolingDown ? 'text-orange-500' : 'text-green-500'}`}>
                      {item.lastTestedRound > 0 ? cooldownText : '(Ready)'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => onDeleteWord(item.word)}
                      className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 transition-colors"
                      title="Delete word"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {sortedVocab.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No vocabulary found. Add some words to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
