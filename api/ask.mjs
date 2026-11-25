import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { getKey, invalidateKey, isInvalidOpenAIKeyError, toSafeError } from "../helper/getKey.mjs";

function sendJson(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.json(body);
}

function normalizedQuestion(question) {
  return question.toLowerCase().replace(/[^a-z0-9\u00c0-\u024f\u4e00-\u9fff]+/g, " ").trim();
}

function parseJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned);
}

function asksForActivityChoice(question) {
  return /what (do|would) you (want|like) to do|what kind of activity|what activity|which activity|what do you want to do|what would you like to do|what sounds fun|what do you prefer|do you prefer (team|group) work|what topic|what do you like|which topics|what interests you|what are you interested in|\b(walk|walking|music|song|sing|garden|gardening|paint|painting|craft|crafts|puzzle|riddle|crossword|sudoku|trivia|cook|cooking|dance|dancing|book|reading|photo|photograph|bird|game|sport|exercise)\b/i.test(question || "");
}

function asksForHardToKnowFact(question) {
  return /\bhow many\b|\bwhat year\b|\bwhat date\b|\bwhat is your (diagnosis|medication|blood pressure|address)\b|\bname (three|five)\b|\bexplain\b|\bdescribe in detail\b|\bwhat is the name of\b|\bremember when\b/i.test(question || "");
}

async function createResponse({ instructions, input }) {
  const request = async (apiKey) => {
    const client = new OpenAI({ apiKey });
    return client.responses.create({ model: "gpt-5.6-luna", instructions, input });
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

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.status(204).setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: { message: "Method not allowed.", fix: "Send a POST request to /api/ask." } });
    return;
  }

  try {
    const answers = typeof request.body === "string" ? JSON.parse(request.body) : request.body || {};

    const brief = await fs.readFile(path.join(process.cwd(), "BRIEF.md"), "utf8");
    if (answers.mode === "question") {
      if (typeof answers.language !== "string" || !answers.language.trim() || !Array.isArray(answers.previousAnswers) || !Array.isArray(answers.askedQuestions)) {
        sendJson(response, 400, { error: { message: "The question request is incomplete.", fix: "Go back and answer the language and question fields." } });
        return;
      }
      const questionInstructions = `${brief}\n\nCreate one new, very simple preference question in ${answers.language} to help choose a safe activity for an older adult. This is question ${answers.askedQuestions.length + 1} of 7 maximum. You may finish early when the previous answers already give enough information to suggest activities. If you finish, return {"done":true,"question":"","options":[]} and do not ask another question. Use short sentences and common everyday words that are easy for an older adult to understand. Ask broad questions about daily life, comfort, surroundings, energy, or past experiences. Do not ask directly what topic the user likes. Do not list topic choices such as plants, music, or arts and crafts. Do not name, hint at, or describe a possible activity. Never mention walking, music, singing, gardening, painting, crafts, puzzles, riddles, cooking, dancing, books, photos, games, sports, or exercise in a question. Do not ask what sounds fun, what the user prefers to do, what activity they want, or whether they prefer team or group work. Do not ask them to choose an activity. Do not use hard words, jargon, or abstract words. The first question may cover personality, but after that choose the single most useful new detail yourself from the user's previous answers. Do not follow a preset category list. Use the entire previous answer history to narrow the activity step by step. Never repeat or closely rephrase a previous question. If the user chose Introverted, ask a new broad question about comfort or daily life instead of a group question. If the user chose Extroverted, ask a new broad question about social comfort or energy without asking them to choose an activity. Do not ask for a name, address, health information, or other personal information. Return only valid JSON in this exact shape: {"done":false,"question":"one short simple broad question","options":["four to six short answer choices"]}. For later questions, create answer choices that are broad and do not name possible activities or topics. ${(answers.options || []).length > 0 ? `For this first question, use these answer choices exactly, translated only if needed: ${JSON.stringify(answers.options)}.` : ""}\n\nPrevious questions:\n${answers.askedQuestions.join("\n") || "None"}\n\nPrevious answers:\n${answers.previousAnswers.map(({ question, answer }) => `${question} — ${answer}`).join("\n") || "None"}`;
      const easyAnswerRules = "Ask only about something the user definitely knows from everyday life. Never ask for exact facts, dates, numbers, specialist knowledge, difficult memory, or information the user may not know. If unsure, ask a simpler everyday question or finish early.";
      let questionResponse = await createResponse({ instructions: `${questionInstructions}\n${easyAnswerRules}`, input: "Create the next question now." });
      let questionData;
      try {
        questionData = parseJson(questionResponse.output_text);
      } catch {
        questionData = { done: false, question: questionResponse.output_text, options: [] };
      }
      if (questionData.done === true) {
        sendJson(response, 200, { done: true, question: "", options: [] });
        return;
      }
      if (answers.askedQuestions.some((previous) => normalizedQuestion(previous) === normalizedQuestion(questionData.question)) || asksForActivityChoice(questionData.question) || asksForHardToKnowFact(questionData.question)) {
        questionResponse = await createResponse({ instructions: `${questionInstructions}\n${easyAnswerRules}\nYour last draft was invalid because it repeated a question, asked what activity the user wants, or asked for something the user may not know. Write a different easy everyday question now.`, input: "Create a different easy preference question now." });
        try {
          questionData = parseJson(questionResponse.output_text);
        } catch {
          questionData = { done: false, question: questionResponse.output_text, options: [] };
        }
      }
      if (questionData.done === true) {
        sendJson(response, 200, { done: true, question: "", options: [] });
        return;
      }
      sendJson(response, 200, { done: false, question: questionData.question, options: Array.isArray(questionData.options) ? questionData.options : [] });
      return;
    }

    if (answers.mode !== "activity" || typeof answers.language !== "string" || !answers.language.trim() || !Array.isArray(answers.answers) || answers.answers.length < 1) {
      sendJson(response, 400, { error: { message: "Please answer at least one question.", fix: "Answer the preference questions before asking for activities." } });
      return;
    }
    const completion = await createResponse({
      instructions: `${brief}\n\nSuggest exactly three fresh, safe, gentle activities for an older adult using all of the user's answers below. Do not ask a question. Reply in ${answers.language}. Use very simple everyday words. For each activity, give a short title and two short sentences: say what to do, then add one helpful example or easy first step. If the activity involves music, suggest one gentle, well-known song when it fits. For other activities, add a simple item to use or a clear first step. The activities must be easy to start and should not need a lot of attention, memory, problem solving, or physical effort. Never suggest puzzles, riddles, crosswords, Sudoku, trivia, complicated games, hard crafts, fast exercise, heavy lifting, climbing, driving, or cooking with heat. Prefer calm, low-effort ideas such as listening to music, looking at photos, a gentle walk, easy gardening, simple coloring, or talking with someone when they fit the answers. Do not include personal information or invent facts. Do not repeat the previous activity ideas unless necessary. Return only valid JSON in this exact shape: {"activities":["three helpful activities with a small example"]}.\n\nUser answers:\n${answers.answers.map(({ question, answer }) => `${question} — ${answer}`).join("\n")}\n\nPrevious activity ideas to avoid:\n${(answers.previousActivities || []).join("\n") || "None"}`,
      input: "Suggest three fresh activities now.",
    });

    let activities = [];
    try {
      const parsed = parseJson(completion.output_text);
      activities = Array.isArray(parsed.activities) ? parsed.activities : [];
    } catch {
      activities = completion.output_text.split(/\n+/).map((item) => item.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean).slice(0, 3);
    }
    if (activities.length < 3) {
      sendJson(response, 500, { error: { message: "The activity helper could not find enough ideas.", fix: "Try the request again once; if it continues, check the AI helper logs." } });
      return;
    }
    sendJson(response, 200, { activities });
  } catch (error) {
    const safeError = toSafeError(error, "The activity helper could not answer.", "Check MindDo key settings and the server logs.");
    console.error("Sunventure Vercel fix:", safeError.fix);
    sendJson(response, 500, { error: safeError });
  }
}
