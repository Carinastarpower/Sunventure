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
  return /what (do|would) you (want|like) to do|what kind of activity|what activity|which activity|what do you want to do|what would you like to do/i.test(question || "");
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
      const questionInstructions = `${brief}\n\nCreate one new, simple preference question in ${answers.language} to help choose a safe activity for an older adult. This is question ${answers.askedQuestions.length + 1} of 7 maximum. You may finish early when the previous answers already give enough information to suggest activities. If you finish, return {"done":true,"question":"","options":[]} and do not ask another question. The first question may cover personality, but after that choose the single most useful next detail yourself from the user's previous answers. Do not follow a preset category list. Use the entire previous answer history to narrow the activity step by step. Never repeat or closely rephrase a previous question, and never ask what the user wants to do, what activity they want, or what kind of activity they want. Ask only preference questions that help choose an activity. For example, if the user chose Introverted, do not ask a generic gathering or group question; ask a new preference such as quiet versus stimulating, creative versus learning, or indoor versus outdoor. If the user chose Extroverted, ask a new preference that helps distinguish the kind of social setting or energy they enjoy. Do not ask for a name, address, health information, or other personal information. Return only valid JSON in this exact shape: {"done":false,"question":"one simple preference question","options":["four to six short answer choices"]}. ${(answers.options || []).length > 0 ? `For this first question, use these answer choices exactly, translated only if needed: ${JSON.stringify(answers.options)}.` : "For later questions, create answer choices that fit the new preference question and the previous answers."}\n\nPrevious questions:\n${answers.askedQuestions.join("\n") || "None"}\n\nPrevious answers:\n${answers.previousAnswers.map(({ question, answer }) => `${question} — ${answer}`).join("\n") || "None"}`;
      let questionResponse = await createResponse({ instructions: questionInstructions, input: "Create the next question now." });
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
      if (answers.askedQuestions.some((previous) => normalizedQuestion(previous) === normalizedQuestion(questionData.question)) || asksForActivityChoice(questionData.question)) {
        questionResponse = await createResponse({ instructions: `${questionInstructions}\nYour last draft was invalid because it repeated a question or asked what activity the user wants. Write a different preference question now.`, input: "Create a different preference question now." });
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
      instructions: `${brief}\n\nSuggest exactly three fresh, safe, simple activities using all of the user's answers below. Do not ask a question. Reply in ${answers.language}. Keep each activity to a short title and one short sentence. Do not include personal information or invent facts. Do not repeat the previous activity ideas unless necessary. Return only valid JSON in this exact shape: {"activities":["three short activities"]}.\n\nUser answers:\n${answers.answers.map(({ question, answer }) => `${question} — ${answer}`).join("\n")}\n\nPrevious activity ideas to avoid:\n${(answers.previousActivities || []).join("\n") || "None"}`,
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
