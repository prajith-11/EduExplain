import { GoogleGenAI, Type } from "@google/genai";
import { StudentData, PredictionResult } from "../types";
import axios from "axios";

// Use process.env for compatibility with AI Studio, and import.meta.env for standard Vite local dev
const getApiKey = () => {
  const metaEnv = (import.meta as any).env;
  return process.env.GEMINI_API_KEY || (metaEnv && metaEnv.VITE_GEMINI_API_KEY) || "";
};

const getAiInstance = () => {
  const key = getApiKey();
  return new GoogleGenAI({ apiKey: key });
};

export async function predictBatchStudentGrades(batch: StudentData[]): Promise<PredictionResult[]> {
  const apiKey = getApiKey();
  if (!apiKey || apiKey === "TODO_KEYHERE") {
    console.error("GEMINI_API_KEY is missing. Please set it in your .env file or environment variables.");
    throw new Error("API_KEY_MISSING");
  }

  try {
    // 1. Get deterministic predictions from our backend
    const backendStudents = batch.map(s => ({
      ...s,
      sex: s.sex === 'F' ? 1 : 0,
      activities: s.activities ? 1 : 0,
      internet: s.internet ? 1 : 0
    }));
    const response = await axios.post("/api/predict", { students: backendStudents });
    const predictions = response.data;

    // 2. Get AI explanations for the entire batch in one call
    const ai = getAiInstance();
    const explanationPrompt = `
      You are an AI explaining student performance predictions using SHAP principles.
      
      DATASET CONTEXT: UCI Student Performance (Math).
      SCALES: Midterms (0-30), Final Grade (0-10.00).

      BATCH DATA:
      ${batch.map((s, i) => `
      Student ${i + 1}:
      - Input: ${JSON.stringify(s)}
      - Predicted: ${predictions[i].predictedGrade}/10.00 (Class ${predictions[i].gradeClass})
      - Confidence: ${(predictions[i].confidence * 100).toFixed(2)}%
      `).join('\n')}

      TASK for EACH student:
      1. Provide a detailed SHAP-based explanation in markdown bullet points.
      2. Identify top 3 factors and their impact (Positive/Negative).
      3. Provide 3 actionable recommendations.

      Return an array of objects matching the input order.
    `;

    const aiResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: explanationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              explanation: { type: Type.STRING },
              featureImportance: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    feature: { type: Type.STRING },
                    importance: { type: Type.NUMBER },
                  },
                  required: ["feature", "importance"],
                },
              },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ["explanation", "featureImportance", "recommendations"],
          },
        },
      },
    });

    if (!aiResponse.text) throw new Error("No response from Gemini");
    const aiResults = JSON.parse(aiResponse.text);

    return predictions.map((pred: any, i: number) => ({
      ...pred,
      explanation: aiResults[i].explanation,
      featureImportance: aiResults[i].featureImportance,
      recommendations: aiResults[i].recommendations
    }));
  } catch (error) {
    console.error("Prediction Error:", error);
    throw error;
  }
}

export async function chatWithGemini(
  messages: { role: 'user' | 'model'; parts: { text: string }[] }[],
  systemInstruction?: string
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey || apiKey === "TODO_KEYHERE") {
    console.error("GEMINI_API_KEY is missing. Please set it in your .env file or environment variables.");
    throw new Error("API_KEY_MISSING");
  }

  const ai = getAiInstance();
  const defaultInstruction = "You are EduBot, an AI academic advisor for the EduExplain platform. Help students with study tips, academic advice, and platform navigation. Use Markdown (bolding, lists, and tables) to make your answers highly visual and easy to scan. Be encouraging, professional, and concise.";
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: messages,
      config: {
        systemInstruction: systemInstruction || defaultInstruction,
      },
    });

    return response.text || "I'm sorry, I couldn't process that request.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
