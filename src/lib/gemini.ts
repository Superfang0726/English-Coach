import { GoogleGenAI, Type } from '@google/genai';

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
3. 測驗模式：每次出 2 題單選題。題幹中需刻意埋入 1-2 個 O 區單字作為背景。
4. 測驗後處理：我回覆選項後，請進行「錯誤診斷」，並根據我的表現動態更新單字級別，列出最新的變動狀態。
5. 出題規定：必須要檢查題目中是否有可填入的空格

## 三、 輸出排版要求
1. **絕對不要**使用 HTML 標籤（如 <br> 或 <br/>）。請一律使用 Markdown 的標準換行符號。
2. 選擇題的各個選項（A, B, C, D）之間**必須換行**，讓每個選項獨立一行，方便閱讀。
`;

export async function generateQuestions(vocab: any[], currentRound: number, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });
  const vocabWithCooldown = vocab.map(v => {
    const roundsSinceTested = currentRound - v.lastTestedRound;
    const isCoolingDown = v.lastTestedRound > 0 && roundsSinceTested < 3;
    return {
      ...v,
      isCoolingDown
    };
  });

  const prompt = `
請根據以下單字庫與規則，出 2 題單選題。
當前輪數：${currentRound}

單字庫：
${JSON.stringify(vocabWithCooldown)}

【重要提醒】：請注意單字庫中的 \`isCoolingDown\` 屬性。如果為 true，代表該單字正在冷卻期，絕對不能作為主考題（但可以作為背景單字）。如果為 false，代表已經解除冷卻，可以作為主考題。
請回傳 JSON 格式，包含 \`message\` 欄位（題目內容，請用 Markdown 格式排版）。
`;

  try {
    console.log('[Gemini] Generating questions with apiKey length:', apiKey?.length, 'model: gemini-2.0-flash');
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gemini API request timed out (30s)')), 30000);
    });

    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              message: { type: Type.STRING }
            },
            required: ['message']
          }
        }
      }),
      timeoutPromise
    ]) as any;

    console.log('[Gemini] Response received:', response.text?.substring(0, 200));
    const parsed = JSON.parse(response.text!);
    return parsed.message
      .replace(/\\n/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n');
  } catch (error: any) {
    console.error('[Gemini] generateQuestions ERROR:', error);
    console.error('[Gemini] Error message:', error?.message);
    console.error('[Gemini] Error status:', error?.status);
    console.error('[Gemini] Error details:', JSON.stringify(error?.errorDetails || error?.response?.data, null, 2));
    throw error;
  }
}

export async function evaluateAnswers(questions: string, userAnswer: string, vocab: any[], currentRound: number, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });
  const vocabWithCooldown = vocab.map(v => {
    const roundsSinceTested = currentRound - v.lastTestedRound;
    const isCoolingDown = v.lastTestedRound > 0 && roundsSinceTested < 3;
    return {
      ...v,
      isCoolingDown
    };
  });

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

請回傳 JSON 格式，包含：
- \`message\`: 給使用者的解析與回饋（Markdown 格式，請在回饋中明確告知哪些單字升級或降級了）
- \`updates\`: 需要更新級別的單字陣列。每個物件包含：
  - \`word\`: 必須與單字庫中的拼字完全一致（純單字，絕對不可加上 "-to-^" 或其他後綴字元）
  - \`newLevel\`: 更新後的級別字串，只能是 'O', '^', 'X' 其中之一。
  若無變動可傳空陣列。
- \`testedWords\`: 本次作為主考題的單字陣列（純字串陣列，必須與單字庫中的拼字完全一致）
`;

  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gemini API request timed out (30s)')), 30000);
    });

    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              message: { type: Type.STRING },
              updates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    word: { type: Type.STRING },
                    newLevel: { type: Type.STRING }
                  }
                }
              },
              testedWords: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ['message', 'updates', 'testedWords']
          }
        }
      }),
      timeoutPromise
    ]) as any;

    const parsed = JSON.parse(response.text!);
    if (parsed.message) {
      parsed.message = parsed.message
        .replace(/\\n/g, '\n')
        .replace(/<br\s*\/?>/gi, '\n');
    }
    return parsed;
  } catch (error: any) {
    console.error('[Gemini] evaluateAnswers ERROR:', error);
    console.error('[Gemini] Error message:', error?.message);
    console.error('[Gemini] Error status:', error?.status);
    console.error('[Gemini] Error details:', JSON.stringify(error?.errorDetails || error?.response?.data, null, 2));
    throw error;
  }
}
