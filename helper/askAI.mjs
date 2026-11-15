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

export async function askSunventureQuestion({ language, previousAnswers = [], askedQuestions = [] }) {
  const instructions = `Ask exactly one new, simple question in ${language} to help choose a safe activity for an older adult. This is question ${askedQuestions.length + 1} of 5. Use the answers already given to decide what would be useful to ask next. Never repeat or closely rephrase a previous question. Do not ask for a name, address, health information, or other personal information. Reply with only the question, with no number, preface, or extra text.\n\nPrevious questions:\n${askedQuestions.join("\n") || "None"}\n\nPrevious answers:\n${previousAnswers.map(({ question, answer }) => `${question} — ${answer}`).join("\n") || "None"}`;
  let question = await createResponse({ instructions, input: "Create the next question now." });
  if (askedQuestions.some((previous) => normalizedQuestion(previous) === normalizedQuestion(question))) {
    question = await createResponse({ instructions: `${instructions}\nYour last draft was a repeat. Write a completely different question now.`, input: "Create a different next question now." });
  }
  return question;
}

export async function askSunventureAI({ language, answers }) {
  return createResponse({
    instructions: `Suggest one safe, simple activity using all of the user's answers below. Do not ask a question. Reply in ${language}. Keep it to a short title and 1-2 short sentences. Do not include personal information or invent facts.\n\nUser answers:\n${answers.map(({ question, answer }) => `${question} — ${answer}`).join("\n")}`,
    input: "Suggest the best activity now.",
  });
}
