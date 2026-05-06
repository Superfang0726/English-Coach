import assert from 'node:assert/strict';
import {
  buildQuestionGenerationPrompt,
  formatQuestionsForMarkdown,
  normalizeVocabularySuggestions,
  type GeneratedQuestion,
} from './gemini.ts';

const sampleQuestion: GeneratedQuestion = {
  number: 1,
  stem: 'The manager must _____ enough staff for the weekend shift.',
  choices: {
    A: 'allocate',
    B: 'budget',
    C: 'consult',
    D: 'revise',
  },
  targetWord: 'allocate',
};

assert.equal(
  formatQuestionsForMarkdown([sampleQuestion]),
  [
    '1. The manager must _____ enough staff for the weekend shift.',
    'A. allocate',
    'B. budget',
    'C. consult',
    'D. revise',
  ].join('\n')
);

const prompt = buildQuestionGenerationPrompt(
  [{ word: 'allocate', meaning: '分配', level: 'X', lastTestedRound: 0 }],
  3
);

assert.match(prompt, /出 1 題單選題/);
assert.doesNotMatch(prompt, /出 2 題單選題/);

assert.deepEqual(
  normalizeVocabularySuggestions([
    { word: 'recession', meaning: '經濟衰退', level: 'X' },
    { word: 'curtail', meaning: '縮減', level: '^' },
    { word: 'invalid', meaning: '無效', level: 'bad' },
    { word: '   ', meaning: '空白', level: 'X' },
  ]),
  [
    { word: 'recession', meaning: '經濟衰退', level: 'X' },
    { word: 'curtail', meaning: '縮減', level: '^' },
  ]
);

console.log('gemini formatting tests passed');
