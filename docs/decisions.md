# Decisions

## Canvas

The board is DOM, not tldraw and not react-konva. tldraw shows a watermark without a license key. Konva draws text into a bitmap, so the lesson text would not be selectable or available to a screen reader. Frames, inspector fields, and keyboard delete stay normal HTML. Draw strokes are stored as points. A later license can replace the stage without changing `Board` or `Shape`.

## Sign-in

Auth.js was not used. Its Google provider refuses to boot when `AUTH_GOOGLE_ID` is empty, and the demo has to sign in with no keys. The session is an HMAC cookie in `src/lib/session.ts`. Username and password always hit the sample accounts. `GET /api/auth/google` redirects to the local account chooser when keys are missing, and to the real OAuth callback when they are present. Unknown Google emails become faculty unless `AUTH_GOOGLE_ROLES` names them.

## Data

One handler module, `src/server/handlers.ts`, is the mock API. The browser calls `/api/harness/*`. FastAPI is used only for `/auth/login` and `/chat`, and only when `NEXT_PUBLIC_HARNESS_API=fastapi` and a token exists. If that call fails, chat stays on the sample threads.

## Theme

Light is the default. Dark is a class on `html`. Gold is a mark on the navy tool dock, not body text.

## Composition

The running UI uses the Cursor reading column and docked composer for Chat, and the Figma-style agent, canvas, tool dock, and inspector for Space. Admin screens are tables. The four static studies in `bakeoff/` are the composition check. The product was not held for a second pick because this run was told to finish every role.

## Page viewer

Citations open an HTML page with a yellow passage. `react-pdf` was left out so the worker and a sample PDF would not become a second document system. The passage and the page number are the thing a teacher checks.
