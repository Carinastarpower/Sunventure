import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

function sendJson(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.json(body);
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
    const required = ["interest", "company", "setting", "language"];
    if (required.some((key) => typeof answers[key] !== "string" || !answers[key].trim())) {
      sendJson(response, 400, { error: "Please answer each question." });
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is missing from the Vercel environment");
    }

    const brief = await fs.readFile(path.join(process.cwd(), "BRIEF.md"), "utf8");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.responses.create({
      model: "gpt-5.6-luna",
      instructions: brief,
      input: [
        {
          role: "user",
          content: `Suggest one safe, simple activity using only these answers. Do not ask a question. Reply in ${answers.language}. Keep it to a short title and 1-2 short sentences.\nInterest: ${answers.interest}\nCompany: ${answers.company}\nPlace: ${answers.setting}`,
        },
      ],
    });

    sendJson(response, 200, { activity: completion.output_text.trim() });
  } catch (error) {
    console.error("Sunventure Vercel function failed:", error.message);
    sendJson(response, 500, { error: "The activity helper could not answer." });
  }
}
