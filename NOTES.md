# Sunventure Version 1

After each save point, push it to GitHub.

## Run it

Use two Terminal windows from this folder:

1. `export PATH="$PWD/.tools/node/bin:$PATH" && npm run helper`
2. `export PATH="$PWD/.tools/node/bin:$PATH" && npx expo start --lan`

The phone and computer must be on the same Wi-Fi. The helper uses the computer address `192.168.1.163`. If that address changes, update `AI_HELPER_URL` in `App.js`. Do not use an Expo tunnel for the AI helper; use LAN mode.

Expo Go SDK: 58
OpenAI model: `gpt-5.6-luna`

## Done

- Created the SDK 58 Expo app.
- Added simple activity questions, language choice, indoor/outdoor filter, reminder time, and the `Find A Activity` button.
- Added local phone storage and a back button on each step.
- Added the computer-only Node helper. It reads `.env`, sends the full `BRIEF.md` instructions to OpenAI, and never puts the key in the app.

## Maybe Later

- The user can cancel the event anytime they want
- The user can set a time of when they want to do the activity

## Next

- Test the full flow on a phone and record the short demo video.
- Improve translations and activity safety after testing with an older adult.
