import http from "node:http";
import { askSunventureAI } from "./askAI.mjs";

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
    const required = ["interest", "company", "setting", "language"];
    if (required.some((key) => typeof answers[key] !== "string" || !answers[key].trim())) {
      sendJson(response, 400, { error: "Please answer each question." });
      return;
    }
    const activity = await askSunventureAI(answers);
    sendJson(response, 200, { activity });
  } catch (error) {
    console.error("Sunventure helper request failed:", error.message);
    sendJson(response, 500, { error: "The activity helper could not answer." });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Sunventure AI helper listening on http://0.0.0.0:${port}`);
});
