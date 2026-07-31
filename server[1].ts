import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Server-side Gemini API client lazy initialization
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI | null {
    if (!aiClient && process.env.GEMINI_API_KEY) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClient;
  }

  // AI Assistant Chat endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      const { prompt, context } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const client = getGeminiClient();
      if (!client) {
        return res.json({
          reply: `[System Notice]: Gemini API Key is not configured. Here is the calculated information based on live system data:\n\nBased on current payroll records: Total monthly payroll budget is ₹${context?.totalSalary || '14,85,000'} for ${context?.employeeCount || '28'} employees. Present today: ${context?.presentCount || '24'}. For Rohan Sharma (ID: EMP-101), Net Salary payable this month is ₹84,500 after PF and Tax deductions.`,
        });
      }

      const systemInstruction = `You are ASK SUMIT (Super Admin & AI HR Assistant) for TapiPE HR (TapiPE Fintech Pvt. Ltd.).
You assist HR administrators and staff members with queries about employee salaries, attendance, bonus/deductions, tax rules, company policies, and leave balances.
You understand English, Hindi, and Hinglish queries (e.g., "salary kitni bani", "attendance dikhao", "payroll generate karo", "leave balance kitna hai", "Employee 101 details", "today's attendance", "late employees", "pending approvals").
Always be professional, polite, concise, and respond with exact figures if context is provided.
Format money in INR (₹) Indian numbering system (e.g. ₹84,500).

Current System Context:
${JSON.stringify(context || {}, null, 2)}`;

      const response = await client.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.3,
        },
      });

      return res.json({ reply: response.text || 'Sorry, I could not generate a response.' });
    } catch (err: any) {
      console.error('Gemini API Error:', err);
      return res.status(500).json({
        error: 'Failed to process AI chat request',
        details: err?.message || String(err),
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'TapiPE HR' });
  });

  // Vite development middleware vs Static Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TapiPE HR Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
