import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { getKey, invalidateKey, isInvalidOpenAIKeyError } from "./getKey.mjs";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

async function createResponse({ instructions, input }) {
  const brief = await fs.readFile(path.join(projectRoot, "BRIEF.md"), "utf8");
  const request = async (apiKey) => {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: "gpt-5.6-luna",
      instructions: `${brief}\n\n${instructions}`,
      input,
    });
    return response.output_text.trim();
  };

  let apiKey = await getKey();
  try {
    return await request(apiKey);
  } catch (error) {
    if (!isInvalidOpenAIKeyError(error)) throw error;
    invalidateKey(apiKey);
    apiKey = await getKey({ forceRefresh: true });
    return request(apiKey);
  }
}

function normalizedQuestion(question) {
  return question.toLowerCase().replace(/[^a-z0-9\u00c0-\u024f\u4e00-\u9fff]+/g, " ").trim();
}

function parseJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned);
}

function asksForActivityChoice(question) {
  return /what (do|would) you (want|like) to do|what kind of activity|what activity|which activity|what do you want to do|what would you like to do/i.test(question || "");
}

export async function askSunventureQuestion({ language, category, options = [], previousAnswers = [], askedQuestions = [] }) {
  const instructions = `Create one new, simple preference question in ${language} to help choose a safe activity for an older adult. This is question ${askedQuestions.length + 1} of 7 maximum. You may finish early when the previous answers already give enough information to suggest activities. If you finish, return {"done":true,"question":"","options":[]} and do not ask another question. The first question may cover personality, but after that choose the single most useful next detail yourself from the user's previous answers. Do not follow a preset category list. Use the entire previous answer history to narrow the activity step by step. Never repeat or closely rephrase a previous question, and never ask what the user wants to do, what activity they want, or what kind of activity they want. Ask only preference questions that help choose an activity. For example, if the user chose Introverted, do not ask a generic gathering or group question; ask a new preference such as quiet versus stimulating, creative versus learning, or indoor versus outdoor. If the user chose Extroverted, ask a new preference that helps distinguish the kind of social setting or energy they enjoy. Do not ask for a name, address, health information, or other personal information. Return only valid JSON in this exact shape: {"done":false,"question":"one simple preference question","options":["four to six short answer choices"]}. ${options.length > 0 ? `For this first question, use these answer choices exactly, translated only if needed: ${JSON.stringify(options)}.` : "For later questions, create answer choices that fit the new preference question and the previous answers."}\n\nPrevious questions:\n${askedQuestions.join("\n") || "None"}\n\nPrevious answers:\n${previousAnswers.map(({ question, answer }) => `${question} — ${answer}`).join("\n") || "None"}`;
  let questionResponse = await createResponse({ instructions, input: "Create the next question now." });
  let questionData;
  try {
    questionData = parseJson(questionResponse);
  } catch {
    questionData = { done: false, question: questionResponse, options: [] };
  }
  if (questionData.done === true) return { done: true, question: "", options: [] };
  let question = questionData.question;
  if (askedQuestions.some((previous) => normalizedQuestion(previous) === normalizedQuestion(question)) || asksForActivityChoice(question)) {
    questionResponse = await createResponse({ instructions: `${instructions}\nYour last draft was invalid because it repeated a question or asked what activity the user wants. Write a different preference question now.`, input: "Create a different preference question now." });
    try {
      questionData = parseJson(questionResponse);
    } catch {
      questionData = { done: false, question: questionResponse, options: [] };
    }
  }
  if (questionData.done === true) return { done: true, question: "", options: [] };
  return { done: false, question: questionData.question, options: Array.isArray(questionData.options) ? questionData.options : [] };
}

export async function askSunventureAI({ language, answers, previousActivities = [] }) {
  const response = await createResponse({
    instructions: `Suggest exactly three fresh, safe, simple activities using all of the user's answers below. Do not ask a question. Reply in ${language}. Keep each activity to a short title and one short sentence. Do not include personal information or invent facts. Do not repeat the previous activity ideas unless necessary. Return only valid JSON in this exact shape: {"activities":["three short activities"]}.\n\nUser answers:\n${answers.map(({ question, answer }) => `${question} — ${answer}`).join("\n")}\n\nPrevious activity ideas to avoid:\n${previousActivities.join("\n") || "None"}`,
    input: "Suggest three fresh activities now.",
  });
  try {
    const parsed = parseJson(response);
    return Array.isArray(parsed.activities) ? parsed.activities : [];
  } catch {
    return response.split(/\n+/).map((item) => item.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean).slice(0, 3);
  }
}
