import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

async function readLocalEnv() {
  const envText = await fs.readFile(path.join(projectRoot, ".env"), "utf8");
  const line = envText.split(/\r?\n/).find((item) => item.startsWith("OPENAI_API_KEY="));
  const apiKey = line?.slice("OPENAI_API_KEY=".length).trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing from .env");
  return apiKey;
}

async function createResponse({ instructions, input }) {
  const brief = await fs.readFile(path.join(projectRoot, "BRIEF.md"), "utf8");
  const client = new OpenAI({ apiKey: await readLocalEnv() });
  const response = await client.responses.create({
    model: "gpt-5.6-luna",
    instructions: `${brief}\n\n${instructions}`,
    input,
  });
  return response.output_text.trim();
}

function normalizedQuestion(question) {
  return question.toLowerCase().replace(/[^a-z0-9\u00c0-\u024f\u4e00-\u9fff]+/g, " ").trim();
}

function parseJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned);
}

export async function askSunventureQuestion({ language, category, previousAnswers = [], askedQuestions = [] }) {
  const instructions = `Create one new question in ${language} about the category "${category}" to help choose safe activities for an older adult. This is question ${askedQuestions.length + 1} of 8. Start broad, then use the previous answers to make later questions more specific. Never repeat or closely rephrase a previous question. Do not ask for a name, address, health information, or other personal information. Return only valid JSON in this exact shape: {"question":"one simple question","options":["six short answer choices"]}. The six choices must be in ${language}.\n\nPrevious questions:\n${askedQuestions.join("\n") || "None"}\n\nPrevious answers:\n${previousAnswers.map(({ question, answer }) => `${question} — ${answer}`).join("\n") || "None"}`;
  let questionResponse = await createResponse({ instructions, input: "Create the next question now." });
  let questionData;
  try {
    questionData = parseJson(questionResponse);
  } catch {
    questionData = { question: questionResponse, options: [] };
  }
  let question = questionData.question;
  if (askedQuestions.some((previous) => normalizedQuestion(previous) === normalizedQuestion(question))) {
    questionResponse = await createResponse({ instructions: `${instructions}\nYour last draft was a repeat. Write a completely different question now.`, input: "Create a different next question now." });
    try {
      questionData = parseJson(questionResponse);
    } catch {
      questionData = { question: questionResponse, options: [] };
    }
  }
  return { question: questionData.question, options: Array.isArray(questionData.options) ? questionData.options : [] };
}

export async function askSunventureAI({ language, answers }) {
  const response = await createResponse({
    instructions: `Suggest at least eight safe, simple activities using all of the user's answers below. Do not ask a question. Reply in ${language}. Keep each activity to a short title and one short sentence. Do not include personal information or invent facts. Return only valid JSON in this exact shape: {"activities":["eight short activities"]}.\n\nUser answers:\n${answers.map(({ question, answer }) => `${question} — ${answer}`).join("\n")}`,
    input: "Suggest eight activities now.",
  });
  try {
    const parsed = parseJson(response);
    return Array.isArray(parsed.activities) ? parsed.activities : [];
  } catch {
    return response.split(/\n+/).map((item) => item.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean).slice(0, 8);
  }
}
