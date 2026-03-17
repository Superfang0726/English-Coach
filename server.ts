import express from 'express';
import { createServer as createViteServer } from 'vite';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const EXCEL_FILE = path.join(__dirname, 'vocab.xlsx');

app.use(express.json());

function readVocab() {
  if (!fs.existsSync(EXCEL_FILE)) {
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet([]);
    xlsx.utils.book_append_sheet(wb, ws, '單字分級匯出與測驗');
    xlsx.writeFile(wb, EXCEL_FILE);
  }
  const wb = xlsx.readFile(EXCEL_FILE);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawData = xlsx.utils.sheet_to_json(ws);
  
  return rawData.map((row: any) => {
    let level = 'X';
    if (row['單字分級']?.includes('O')) level = 'O';
    else if (row['單字分級']?.includes('^')) level = '^';
    
    return {
      word: row['英文拼字'] || '',
      meaning: row['中文意思'] || '',
      level: level,
      remarks: row['備註狀態'] || '',
      lastTestedRound: row['最後測驗回合'] || 0,
    };
  });
}

function writeVocab(data: any[]) {
  const wb = xlsx.utils.book_new();
  const formattedData = data.map((item: any) => {
    let levelStr = '🔴 X 區';
    if (item.level === 'O') levelStr = '🟢 O 區';
    else if (item.level === '^') levelStr = '🟡 ^ 區';
    
    return {
      '英文拼字': item.word,
      '中文意思': item.meaning,
      '單字分級': levelStr,
      '備註狀態': item.remarks || '',
      '最後測驗回合': item.lastTestedRound || 0,
    };
  });
  const ws = xlsx.utils.json_to_sheet(formattedData);
  xlsx.utils.book_append_sheet(wb, ws, '單字分級匯出與測驗');
  xlsx.writeFile(wb, EXCEL_FILE);
}

app.get('/api/vocab', (req, res) => {
  try {
    const data = readVocab();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/vocab', (req, res) => {
  try {
    writeVocab(req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/vocab/download', (req, res) => {
  try {
    if (fs.existsSync(EXCEL_FILE)) {
      res.download(EXCEL_FILE, 'vocab.xlsx');
    } else {
      res.status(404).send('File not found');
    }
  } catch (e) {
    res.status(500).send(String(e));
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
