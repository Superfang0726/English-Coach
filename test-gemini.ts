import { evaluateAnswers } from './src/lib/gemini.js';
import dotenv from 'dotenv';
dotenv.config();

const vocab = [
  { word: "allocate", meaning: "撥款，分配", level: "X", lastTestedRound: 0 },
  { word: "budget", meaning: "預算", level: "O", lastTestedRound: 0 },
  { word: "consult", meaning: "諮詢", level: "^", lastTestedRound: 0 }
];

async function main() {
  try {
    const result = await evaluateAnswers(
      "1. The company decided to _____ more funds to the marketing department. (A) allocate (B) budget\n2. We need to _____ with an expert before making a decision. (A) consult (B) insult",
      "1. (A) 2. (A) 覺得有點猶豫",
      vocab,
      1,
      process.env.GEMINI_API_KEY || ''
    );
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}
main();
