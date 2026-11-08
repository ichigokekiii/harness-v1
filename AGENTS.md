# Harness v1

Faculty chat, Space, and the two admin consoles for Sample Academy. Work only in this folder.

Run `pnpm dev` and open `http://127.0.0.1:3100/login`.

Sample accounts, password `123456`: `faculty`, `admin`, `superadmin`.

`NEXT_PUBLIC_HARNESS_API=fastapi` sends login and chat to the FastAPI app when it is running. Every other screen stays on the local sample store.

No cloud model, consent, credits, or real school records. Do not put the school name, real people, or scans in fixtures.

The model name in the composer is `9B Heretic` from `src/lib/model.ts`.
