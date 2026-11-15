import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

function sendJson(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.json(body);
}

function normalizedQuestion(question) {
  return question.toLowerCase().replace(/[^a-z0-9\u00c0-\u024f\u4e00-\u9fff]+/g, " ").trim();
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.status(204).setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const answers = typeof request.body === "string" ? JSON.parse(request.body) : request.body || {};

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is missing from the Vercel environment");
    }

    const brief = await fs.readFile(path.join(process.cwd(), "BRIEF.md"), "utf8");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    if (answers.mode === "question") {
      if (typeof answers.language !== "string" || !answers.language.trim() || !Array.isArray(answers.previousAnswers) || !Array.isArray(answers.askedQuestions)) {
        sendJson(response, 400, { error: "The question request is incomplete." });
        return;
      }
      const questionInstructions = `${brief}\n\nAsk exactly one new, simple question in ${answers.language} to help choose a safe activity for an older adult. This is question ${answers.askedQuestions.length + 1} of 5. Use the answers already given to decide what would be useful to ask next. Never repeat or closely rephrase a previous question. Do not ask for a name, address, health information, or other personal information. Reply with only the question, with no number, preface, or extra text.\n\nPrevious questions:\n${answers.askedQuestions.join("\n") || "None"}\n\nPrevious answers:\n${answers.previousAnswers.map(({ question, answer }) => `${question} — ${answer}`).join("\n") || "None"}`;
      let questionResponse = await client.responses.create({
        model: "gpt-5.6-luna",
        instructions: questionInstructions,
        input: "Create the next question now.",
      });
      if (answers.askedQuestions.some((previous) => normalizedQuestion(previous) === normalizedQuestion(questionResponse.output_text))) {
        questionResponse = await client.responses.create({
          model: "gpt-5.6-luna",
          instructions: `${questionInstructions}\nYour last draft was a repeat. Write a completely different question now.`,
          input: "Create a different next question now.",
        });
      }
      sendJson(response, 200, { question: questionResponse.output_text.trim() });
      return;
    }

    if (answers.mode !== "activity" || typeof answers.language !== "string" || !answers.language.trim() || !Array.isArray(answers.answers) || answers.answers.length < 5) {
      sendJson(response, 400, { error: "Please answer each question." });
      return;
    }
    const completion = await client.responses.create({
      model: "gpt-5.6-luna",
      instructions: `${brief}\n\nSuggest one safe, simple activity using all of the user's answers below. Do not ask a question. Reply in ${answers.language}. Keep it to a short title and 1-2 short sentences. Do not include personal information or invent facts.\n\nUser answers:\n${answers.answers.map(({ question, answer }) => `${question} — ${answer}`).join("\n")}`,
      input: "Suggest the best activity now.",
    });

    sendJson(response, 200, { activity: completion.output_text.trim() });
  } catch (error) {
    console.error("Sunventure Vercel function failed:", error.message);
    sendJson(response, 500, { error: "The activity helper could not answer." });
  }
}
