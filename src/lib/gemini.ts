import { GoogleGenAI, Type } from '@google/genai';

export const QUESTIONS_PER_ROUND = 1;

export type GeneratedQuestion = {
  number: number;
  stem: string;
  choices: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  targetWord: string;
};

export type GeneratedQuestionPayload = {
  message: string;
  questions: GeneratedQuestion[];
};

const SYSTEM_PROMPT = `
# Role: TOEIC 單字訓練教練 (Dynamic Risk Management Mode)

請擔任我的 TOEIC 單字教練。我有一套專屬的「動態縮小風險區」學習系統與既有的單字資料庫。

## 一、 風險分類定義 (根據我的「大腦體感」定義)
1. O (自我懷疑區)：看到知道意思，但會自我懷疑或猶豫。
   - 處理原則：不作為主考題 (不挖空)。請將這些字「自然夾帶」在題幹句子中讓我閱讀 (無痛刷臉)，消除我的猶豫感。
2. ^ (回想喚醒區)：看過，但需要花時間想起來。
   - 處理原則：在不同語境中輪替考出，強化神經連結。
3. X (完全陌生區 / 忘記區)：完全沒印象，或反覆忘記的字。
   - 處理原則：優先主考，提供多益高頻「固定搭配詞」與精準語境。

## 二、 核心出題與管理規則
1. 語境限定：僅出商業/職場/多益高頻語境。不出冷門義、不出拼字、不出純翻譯。句子需符合多益 Part 5 難度。
2. 間隔重複 (Cooldown 機制)：我最近剛問過、剛測驗過、或剛升降級的單字，必須進入「冷卻期」，至少間隔 3-5 輪以上才能再次作為主考題出現。絕對不要連續考同一個字。
3. 測驗模式：每次出 1 題單選題。題幹中需刻意埋入 1-2 個 O 區單字作為背景。
4. 測驗後處理：我回覆選項後，請進行「錯誤診斷」，並根據我的表現動態更新單字級別，列出最新的變動狀態。
5. 出題規定：檢查題目中是否有底線作為填入答案的空格

## 三、 輸出排版要求
1. **絕對不要**使用 HTML 標籤（如 <br> 或 <br/>）。請一律使用 Markdown 的標準換行符號。
2. 出題時如果被要求回傳 questions JSON，請把題幹放在 stem，把 A、B、C、D 分別放在 choices 的四個欄位，不要把選項混進 stem。
3. 解析與回饋訊息可以使用 Markdown；選擇題本身由前端固定排版。
`;

function withCooldown(vocab: any[], currentRound: number) {
  return vocab.map(v => {
    const roundsSinceTested = currentRound - v.lastTestedRound;
    const isCoolingDown = v.lastTestedRound > 0 && roundsSinceTested < 3;
    return {
      ...v,
      isCoolingDown
    };
  });
}

function normalizeMessage(message: string) {
  return message
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .trim();
}

function toText(value: unknown) {
  return typeof value === 'string' ? normalizeMessage(value) : '';
}

function normalizeQuestions(rawQuestions: unknown): GeneratedQuestion[] {
  if (!Array.isArray(rawQuestions)) return [];

  return rawQuestions.slice(0, QUESTIONS_PER_ROUND).map((question, index) => {
    const q = question as Partial<GeneratedQuestion>;
    const choices = (q.choices || {}) as Partial<GeneratedQuestion['choices']>;

    return {
      number: Number(q.number) || index + 1,
      stem: toText(q.stem),
      choices: {
        A: toText(choices.A),
        B: toText(choices.B),
        C: toText(choices.C),
        D: toText(choices.D),
      },
      targetWord: toText(q.targetWord),
    };
  });
}

export function formatQuestionsForMarkdown(questions: GeneratedQuestion[]) {
  return questions
    .map((question, index) => {
      const number = question.number || index + 1;
      return [
        `${number}. ${question.stem}`,
        `A. ${question.choices.A}`,
        `B. ${question.choices.B}`,
        `C. ${question.choices.C}`,
        `D. ${question.choices.D}`,
      ].join('\n');
    })
    .join('\n\n');
}

export function buildQuestionGenerationPrompt(vocab: any[], currentRound: number) {
  const vocabWithCooldown = withCooldown(vocab, currentRound);

  return `
請根據以下單字庫與規則，出 ${QUESTIONS_PER_ROUND} 題單選題。
當前輪數：${currentRound}

單字庫：
${JSON.stringify(vocabWithCooldown)}

【重要提醒】：請注意單字庫中的 \`isCoolingDown\` 屬性。如果為 true，代表該單字正在冷卻期，絕對不能作為主考題（但可以作為背景單字）。如果為 false，代表已經解除冷卻，可以作為主考題。
請回傳 JSON 格式，包含 \`questions\` 陣列。陣列內必須剛好有 ${QUESTIONS_PER_ROUND} 題。
每題必須包含：
- \`number\`: 題號，從 1 開始。
- \`stem\`: TOEIC Part 5 題幹，必須包含 _____ 作為填空。
- \`choices\`: 包含 \`A\`, \`B\`, \`C\`, \`D\` 四個選項字串。
- \`targetWord\`: 本題主考單字，拼字必須與單字庫完全一致。

不要把選項寫進 \`stem\`，也不要在任何欄位使用 HTML 標籤。
`;
}

export async function generateQuestions(vocab: any[], currentRound: number, apiKey: string, modelName: string = 'gemini-3.1-flash-lite-preview'): Promise<GeneratedQuestionPayload> {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildQuestionGenerationPrompt(vocab, currentRound);

  try {
    console.log('[Gemini] Generating questions with apiKey length:', apiKey?.length, 'model:', modelName);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gemini API request timed out (30s)')), 30000);
    });

    const response = await Promise.race([
      ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                minItems: String(QUESTIONS_PER_ROUND),
                maxItems: String(QUESTIONS_PER_ROUND),
                items: {
                  type: Type.OBJECT,
                  properties: {
                    number: { type: Type.INTEGER },
                    stem: { type: Type.STRING },
                    choices: {
                      type: Type.OBJECT,
                      properties: {
                        A: { type: Type.STRING },
                        B: { type: Type.STRING },
                        C: { type: Type.STRING },
                        D: { type: Type.STRING }
                      },
                      required: ['A', 'B', 'C', 'D']
                    },
                    targetWord: { type: Type.STRING }
                  },
                  required: ['number', 'stem', 'choices', 'targetWord']
                }
              }
            },
            required: ['questions']
          }
        }
      }),
      timeoutPromise
    ]) as any;

    console.log('[Gemini] Response received:', response.text?.substring(0, 200));
    const parsed = JSON.parse(response.text!);
    const questions = normalizeQuestions(parsed.questions);
    const message = questions.length > 0
      ? formatQuestionsForMarkdown(questions)
      : normalizeMessage(parsed.message || '');

    return { message, questions };
  } catch (error: any) {
    console.error('[Gemini] generateQuestions ERROR:', error);
    console.error('[Gemini] Error message:', error?.message);
    console.error('[Gemini] Error status:', error?.status);
    console.error('[Gemini] Error details:', JSON.stringify(error?.errorDetails || error?.response?.data, null, 2));

    // Ensure the status is attached to the thrown error block
    if (error?.status && !error.status) error.status = error.status;

    throw error;
  }
}

export async function evaluateAnswers(questions: string, userAnswer: string, vocab: any[], currentRound: number, apiKey: string, modelName: string = 'gemini-3.1-flash-lite-preview') {
  const ai = new GoogleGenAI({ apiKey });
  const vocabWithCooldown = withCooldown(vocab, currentRound);

  const prompt = `
題目：
${questions}

使用者回答：
${userAnswer}

當前單字庫：
${JSON.stringify(vocabWithCooldown)}
當前輪數：${currentRound}

請評估使用者的回答，給予解析，並決定單字的新級別。

【升降級判定規則】：
1. 答對且無猶豫：升級 (X -> ^, 或 ^ -> O)。
2. 答錯或猶豫：降級 (O -> ^, 或 ^ -> X)。
3. 已經是 O 區且答對，保持 O 區；已經是 X 區且答錯，保持 X 區。

請呼叫 \`update_vocabulary_levels\` 函式來回報評估結果，包含給使用者的回饋、需要更新級別的單字，以及本次作為主考題的單字。
【注意事項】：
- updates 裡的 word 必須與單字庫中的拼字完全一致（純單字，不可加上後綴字元，例如 "-to-^"）。
- testedWords 是本次作為主考題的單字陣列（純字串陣列，拼字必須完全一致）。
- message 是給使用者的解析與回饋（ Markdown 格式，明確告知哪些單字升降級）。
`;

  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gemini API request timed out (30s)')), 30000);
    });

    const response = await Promise.race([
      ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{
            functionDeclarations: [{
              name: 'update_vocabulary_levels',
              description: 'Report the evaluation result, including user feedback, vocabulary level updates, and tested words.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  message: {
                    type: Type.STRING,
                    description: '給使用者的解析與回饋（Markdown 格式，請在回饋中明確告知哪些單字升級或降級了）'
                  },
                  updates: {
                    type: Type.ARRAY,
                    description: '需要更新級別的單字陣列。若無變動可傳空陣列。',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        word: { type: Type.STRING, description: '必須與單字庫中的拼字完全一致。' },
                        newLevel: { type: Type.STRING, description: '更新後的級別字串，只能是 "O", "^", "X" 其中之一。' }
                      },
                      required: ['word', 'newLevel']
                    }
                  },
                  testedWords: {
                    type: Type.ARRAY,
                    description: '本次作為主考題的單字陣列',
                    items: { type: Type.STRING }
                  }
                },
                required: ['message', 'updates', 'testedWords']
              }
            }]
          }]
        }
      }),
      timeoutPromise
    ]) as any;

    let result = {
      message: response.text || '解析完成。',
      updates: [],
      testedWords: []
    };

    // Extract tool calls from the response if any
    const functionCall = response.functionCalls?.[0];
    if (functionCall && functionCall.name === 'update_vocabulary_levels') {
      const args = functionCall.args as any;
      result.message = args.message || result.message;
      result.updates = args.updates || [];
      result.testedWords = args.testedWords || [];
    } else {
      // Fallback: If no function call, check if the model still generated JSON
      try {
        const parsed = JSON.parse(response.text!);
        if (parsed.updates) result.updates = parsed.updates;
        if (parsed.testedWords) result.testedWords = parsed.testedWords;
        if (parsed.message) result.message = parsed.message;
      } catch (e) {
        // Not a JSON response, fallback to plain text message
      }
    }

    if (result.message) {
      result.message = normalizeMessage(result.message);
    }

    return result;
  } catch (error: any) {
    console.error('[Gemini] evaluateAnswers ERROR:', error);
    console.error('[Gemini] Error message:', error?.message);
    console.error('[Gemini] Error status:', error?.status);
    console.error('[Gemini] Error details:', JSON.stringify(error?.errorDetails || error?.response?.data, null, 2));

    // Ensure the status is attached to the thrown error block
    if (error?.status && !error.status) error.status = error.status;

    throw error;
  }
}
