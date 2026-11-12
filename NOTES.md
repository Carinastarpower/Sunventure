# Sunventure Version 1

After each save point, push it to GitHub.

## Run it

Use two Terminal windows from this folder:

1. `export PATH="$PWD/.tools/node/bin:$PATH" && npm run helper`
2. `export PATH="$PWD/.tools/node/bin:$PATH" && npx expo start --lan`

The phone and computer must be on the same Wi-Fi. The helper uses the computer address `192.168.1.163`. If that address changes, update `AI_HELPER_URL` in `App.js`. Do not use an Expo tunnel for the AI helper; use LAN mode.

Expo Go SDK: 58
OpenAI model: `gpt-5.6-luna`

## Web and Vercel

The web build uses the same Expo SDK 58 app. The browser keeps the app in a centered phone-sized frame (up to 400 pixels wide); Expo Go keeps its existing native layout. On the web, the app calls `api/ask.mjs`, a small Vercel function. In Expo Go, it continues to call the local helper above.

The Vercel function reads `OPENAI_API_KEY` only from Vercel's server environment and reads the shared instructions from `BRIEF.md`. The key is never bundled into the app. `.env` and `.env*` files stay ignored by Git.

To publish it with Vercel:

1. Import the GitHub repository into Vercel.
2. Leave the build settings from `vercel.json` in place: Vercel runs `expo export -p web` and serves `dist`.
3. Add one Vercel environment variable named `OPENAI_API_KEY` with the OpenAI key. Add it for the environments you deploy (Preview and/or Production).
4. Deploy. No other Vercel setting is required for this app.

To test the production-shaped web bundle locally, run `npx expo export -p web` and then `npx expo serve`. For normal development, run `npx expo start --web`.

## Done

- Created the SDK 58 Expo app.
- Added simple activity questions, language choice, indoor/outdoor filter, reminder time, and the `Find A Activity` button.
- Added local phone storage and a back button on each step.
- Added the computer-only Node helper. It reads `.env`, sends the full `BRIEF.md` instructions to OpenAI, and never puts the key in the app.
- Added Expo web support, the centered phone frame, the Vercel AI function, and Vercel's single-page-app rewrite configuration.

## Maybe Later

- The user can cancel the event anytime they want
- The user can set a time of when they want to do the activity

## Next

- Test the full flow on a phone and record the short demo video.
- Improve translations and activity safety after testing with an older adult.
