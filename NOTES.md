# Sunventure Version 1

After each save point, push it to GitHub.

## Run it

Use two Terminal windows from this folder:

1. `export PATH="$PWD/.tools/node/bin:$PATH" && npm run helper`
2. `export PATH="$PWD/.tools/node/bin:$PATH" && npx expo start --lan`

The phone and computer must be on the same Wi-Fi. The helper uses the computer address `192.168.1.163`. If that address changes, update `AI_HELPER_URL` in `App.js`. Do not use an Expo tunnel for the AI helper; use LAN mode.

## Try the MVP in 2 steps

1. In two terminals, run `npm run helper` and `npx expo start --lan`, then open the app in Expo Go.
2. Choose a language, tap `Continue`, answer the preference questions, choose one of the three activities, and set the reminder.

Expo Go SDK: 58
Verified OpenAI model with “luna” in its name: `gpt-5.6-luna`

## Web and Vercel

The web build uses the same Expo SDK 58 app. The website fills the entire browser window; Expo Go keeps its existing native layout. On the web, the app calls `api/ask.mjs`, a small Vercel function. In Expo Go, it continues to call the local helper above.

The AI key comes from `getKey()`. Server code reads `KEYGEN_URL` and `KEYGEN_TOKEN`, asks MindDo for a short-lived OpenAI key, caches it until `expiresAt`, and refreshes it once if OpenAI rejects it. The key and token are never bundled into the app. `.env` and `.env*` files stay ignored by Git.

To publish it with Vercel:

1. Import the GitHub repository into Vercel.
2. Leave the build settings from `vercel.json` in place: Vercel runs `expo export -p web` and serves `dist`.
3. Add `KEYGEN_URL` and `KEYGEN_TOKEN` to the Vercel server environment. Add them for the environments you deploy (Preview and/or Production).
4. Deploy. No other Vercel setting is required for this app.

To test the production-shaped web bundle locally, run `npx expo export -p web` and then `npx expo serve`. For normal web development, run `npm run helper` in one terminal and `npx expo start --web` in another; the development web app uses that local helper, while the deployed web app uses the Vercel function.

## Done

- Created the SDK 58 Expo app.
- Added a language page as the first screen. After choosing English, Chinese, or Spanish, the original welcome page and the rest of the app use that language. The first question may use the personality example, then AI chooses up to twelve narrowing preference questions from the user's answers, can stop early when enough is known, and never asks what activity the user wants. Each question has no more than six clear answer choices. It then suggests three activities at a time; Try another idea replaces them with three fresh suggestions.
- AI activity suggestions are gentle and older-adult friendly: they use simple words and avoid puzzles, riddles, trivia, complex tasks, and high-effort activities.
- AI questions use simple everyday things the user is likely to know, such as how they feel or when they have energy. They avoid hard facts, exact numbers, specialist knowledge, difficult memory, and questions that may be unknown to the user.
- Background music uses the piano-only track “Elementary” by Scott Buckley. It is licensed CC BY 4.0; keep the creator credit and source link when publishing: https://www.scottbuckley.com.au/library/elementary
- New reminders start at `00:00`. Expo Go schedules a local phone notification; the website downloads a calendar reminder file that can be opened to add it to the user's calendar.
- After setting a reminder, the user can cancel it. Expo Go cancels the scheduled phone notification; the website downloads a calendar cancellation file with the same event ID.
- Added local phone storage and a back button on each step.
- Added the computer-only Node helper. It calls server-only `getKey()`, sends the full `BRIEF.md` instructions to OpenAI, and never puts the key in the app.
- Added Expo web support, the full-screen website layout, the Vercel AI function, and Vercel's single-page-app rewrite configuration.

## Maybe Later

- The user can cancel the event anytime they want
- The user can set a time of when they want to do the activity

## Next

- Test the full flow on a phone and record the short demo video.
- Improve translations and activity safety after testing with an older adult.
