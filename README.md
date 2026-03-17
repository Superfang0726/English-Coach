# TOEIC Vocabulary Training Coach

This application is a TOEIC vocabulary training tool that uses a "Dynamic Risk Management" approach. It categorizes words into three zones (O, ^, X) based on your familiarity and uses AI (Gemini) to generate context-aware questions.

## Features

- **Dynamic Risk Management**: Words are categorized into:
  - 🟢 **O (Self-Doubt Zone)**: You know the meaning but hesitate.
  - 🟡 **^ (Recall Zone)**: You've seen it but need time to remember.
  - 🔴 **X (Stranger Zone)**: Completely new or frequently forgotten.
- **AI-Powered Questions**: Uses Google Gemini to create TOEIC Part 5 style questions in business contexts.
- **Cooldown Mechanism**: Words recently tested enter a cooldown period to ensure variety.
- **Excel Integration**: Import/Export your vocabulary list via Excel.
- **Real-time Feedback**: AI evaluates your answers and dynamically updates word levels.

## Local Development

### Prerequisites

- Node.js (v18 or higher)
- npm
- A Google Gemini API Key

### Setup

1. **Clone the repository** (or download the source code).

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Run the application**:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`.

## How to Use

1. **Add Vocabulary**: Use the "Vocabulary Database" section on the right to add words manually or upload an Excel file.
2. **Start Training**: The AI will automatically generate questions based on your vocabulary.
3. **Answer Questions**: Type your answer (A, B, C, or D) in the chat.
4. **Review Feedback**: The AI will explain the answer and update the word's level based on your performance.
5. **Next Round**: Click "Next Round" to generate new questions.

## Tech Stack

- **Frontend**: React, Tailwind CSS, Lucide React
- **Backend**: Express.js
- **AI**: Google Gemini API (@google/genai)
- **Data Storage**: Excel (xlsx) for vocabulary, LocalStorage for chat history
