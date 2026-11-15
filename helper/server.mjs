import http from "node:http";
import { askSunventureAI, askSunventureQuestion } from "./askAI.mjs";

const port = Number(process.env.PORT || 8787);

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    });
    response.end();
    return;
  }

  if (request.method !== "POST" || request.url !== "/ask") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  try {
    let rawBody = "";
    for await (const chunk of request) rawBody += chunk;
    const answers = JSON.parse(rawBody);
    if (answers.mode === "question") {
      if (typeof answers.language !== "string" || !answers.language.trim() || !Array.isArray(answers.previousAnswers) || !Array.isArray(answers.askedQuestions)) {
        sendJson(response, 400, { error: "The question request is incomplete." });
        return;
      }
      const question = await askSunventureQuestion(answers);
      sendJson(response, 200, question);
      return;
    }

    if (answers.mode !== "activity" || typeof answers.language !== "string" || !answers.language.trim() || !Array.isArray(answers.answers) || answers.answers.length < 7) {
      sendJson(response, 400, { error: "Please answer each question." });
      return;
    }
    const activities = await askSunventureAI(answers);
    if (activities.length < 8) {
      sendJson(response, 500, { error: "The activity helper could not find enough ideas." });
      return;
    }
    sendJson(response, 200, { activities });
  } catch (error) {
    console.error("Sunventure helper request failed:", error.message);
    sendJson(response, 500, { error: "The activity helper could not answer." });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Sunventure AI helper listening on http://0.0.0.0:${port}`);
});
