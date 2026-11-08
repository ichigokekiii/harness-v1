# Decisions

## Canvas

The board is DOM, not tldraw and not react-konva. tldraw shows a watermark without a license key. Konva draws text into a bitmap, so the lesson text would not be selectable or available to a screen reader. Frames, inspector fields, and keyboard delete stay normal HTML. Draw strokes are stored as points. A later license can replace the stage without changing `Board` or `Shape`.

## Sign-in

Auth.js was not used. Its Google provider refuses to boot when `AUTH_GOOGLE_ID` is empty, and the demo has to sign in with no keys. The session is an HMAC cookie in `src/lib/session.ts`. Username and password always hit the sample accounts. `GET /api/auth/google` redirects to the local account chooser when keys are missing, and to the real OAuth callback when they are present. Unknown Google emails become faculty unless `AUTH_GOOGLE_ROLES` names them.

## Data

One handler module, `src/server/handlers.ts`, is the mock API. The browser calls `/api/harness/*`. FastAPI is used only for `/auth/login` and `/chat`, and only when `NEXT_PUBLIC_HARNESS_API=fastapi` and a token exists. If that call fails, chat stays on the sample threads.

## Theme

Light is the default. Dark is a class on `html`.

The palette is Cursor's, read from cursor.com on 2026-11-09. Light uses `#f7f7f4` canvas, `#f2f1ed` chrome, and `#26251e` ink. Dark uses `#1b1913` canvas, `#14120b` chrome, and `#edecec` ink. Primary buttons are ink, not navy. Citation yellow is the only accent, and it marks sources only. The text selection is not yellow, so yellow always means a source.

The chat layout is ChatGPT's, read from chatgpt.com the same day. That means a 260px sidebar that holds the chat history, a centered heading on an empty chat, and a pill composer with a 26px radius. User turns are right-aligned bubbles and assistant turns have no box. The model name sits in the composer as muted text with a chevron, the way Cursor shows it.

`node scripts/loop-shots.mjs` captures every role at 1440 and 390 in both themes into `docs/screens/loop/`, which git ignores. `node scripts/contrast.mjs` reads the tokens from `globals.css`, so it cannot drift from the real palette.

## Composition

The running UI uses the Cursor reading column and docked composer for Chat, and the Figma-style agent, canvas, tool dock, and inspector for Space. Admin screens are tables. The four static studies in `bakeoff/` are the composition check. The product was not held for a second pick because this run was told to finish every role.

## Page viewer

Citations open an HTML page with a yellow passage. `react-pdf` was left out so the worker and a sample PDF would not become a second document system. The passage and the page number are the thing a teacher checks.
