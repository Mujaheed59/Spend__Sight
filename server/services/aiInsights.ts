// server/services/aiInsights.ts
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

export async function generateInsights(expenseSummary: any[], comparison?: any[]) {
  const prompt = `
You are a financial assistant. Based on the user's expense summary, generate clear 
budgeting insights and savings recommendations.

Data:
${JSON.stringify(expenseSummary)}

${comparison ? `Last Month Data: ${JSON.stringify(comparison)}` : ""}

Return JSON in this format:
{
  "recommendations": "string",
  "savingsTips": "string"
}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", // or gpt-4-turbo, gpt-3.5, Gemini equivalent
    messages: [{ role: "user", content: prompt }],
    temperature: 0.5
  });

  const text = response.choices[0].message?.content || "{}";
  try {
    return JSON.parse(text);
  } catch {
    return { recommendations: text, savingsTips: "" };
  }
}
