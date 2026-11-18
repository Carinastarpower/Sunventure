import http from "node:http";
import { askSunventureAI, askSunventureQuestion } from "./askAI.mjs";
import { toSafeError } from "./getKey.mjs";

const port = Number(process.env.PORT || 8787);

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(body));
}

function sendError(response, status, message, fix) {
  sendJson(response, status, { error: { message, fix } });
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
    sendError(response, 404, "This helper route was not found.", "Use POST /ask from the Sunventure app.");
    return;
  }

  try {
    let rawBody = "";
    for await (const chunk of request) rawBody += chunk;
    const answers = JSON.parse(rawBody);
    if (answers.mode === "question") {
      if (typeof answers.language !== "string" || !answers.language.trim() || !Array.isArray(answers.previousAnswers) || !Array.isArray(answers.askedQuestions)) {
        sendError(response, 400, "The question request is incomplete.", "Go back and answer the language and question fields.");
        return;
      }
      const question = await askSunventureQuestion(answers);
      sendJson(response, 200, question);
      return;
    }

    if (answers.mode !== "activity" || typeof answers.language !== "string" || !answers.language.trim() || !Array.isArray(answers.answers) || answers.answers.length < 1) {
      sendError(response, 400, "Please answer at least one question.", "Answer the preference questions before asking for activities.");
      return;
    }
    const activities = await askSunventureAI(answers);
    if (activities.length < 8) {
      sendError(response, 500, "The activity helper could not find enough ideas.", "Try the request again once; if it continues, check the AI helper logs.");
      return;
    }
    sendJson(response, 200, { activities });
  } catch (error) {
    const safeError = toSafeError(error, "The activity helper could not answer.", "Check MindDo key settings, Wi-Fi, and the helper logs.");
    console.error("Sunventure helper fix:", safeError.fix);
    sendJson(response, 500, { error: safeError });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Sunventure AI helper listening on http://0.0.0.0:${port}`);
});
