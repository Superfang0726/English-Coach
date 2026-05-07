import assert from 'node:assert/strict';
import { appendQuestionWordReference, selectQuestionChoice, splitQuestionStemIntoTokens } from './Chat.tsx';

assert.equal(selectQuestionChoice('', 1, 'A'), '1. A');
assert.equal(selectQuestionChoice('1. A', 1, 'B'), '1. B');
assert.equal(selectQuestionChoice('2. C', 1, 'A'), '1. A, 2. C');
assert.equal(selectQuestionChoice('1. A, 2. C', 2, 'D'), '1. A, 2. D');
assert.equal(selectQuestionChoice('vocabulary note', 1, 'A'), 'vocabulary note | 1. A');

assert.deepEqual(
  splitQuestionStemIntoTokens('Due to the sudden increase, the company must optimize its _____.')
    .filter((token) => token.type === 'word')
    .map((token) => [token.text, token.wordIndex]),
  [
    ['Due', 1],
    ['to', 2],
    ['the', 3],
    ['sudden', 4],
    ['increase', 5],
    ['the', 6],
    ['company', 7],
    ['must', 8],
    ['optimize', 9],
    ['its', 10],
  ]
);

assert.equal(
  appendQuestionWordReference('', {
    questionNumber: 1,
    word: 'sudden',
    wordIndex: 4,
  }),
  '問題 1，第 4 個單字「sudden」：'
);

assert.equal(
  appendQuestionWordReference('1. A', {
    questionNumber: 1,
    word: 'sudden',
    wordIndex: 4,
  }),
  '1. A | 問題 1，第 4 個單字「sudden」：'
);

console.log('chat interaction tests passed');
