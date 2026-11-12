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

export async function askSunventureAI({ interest, company, setting, language }) {
  const brief = await fs.readFile(path.join(projectRoot, "BRIEF.md"), "utf8");
  const client = new OpenAI({ apiKey: await readLocalEnv() });
  const response = await client.responses.create({
    model: "gpt-5.6-luna",
    instructions: brief,
    input: [
      {
        role: "user",
        content: `Suggest one safe, simple activity using only these answers. Do not ask a question. Reply in ${language}. Keep it to a short title and 1-2 short sentences.\nInterest: ${interest}\nCompany: ${company}\nPlace: ${setting}`,
      },
    ],
  });
  return response.output_text.trim();
}
