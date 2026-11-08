# Status

Checked 9 Nov 2026 on this machine.

| Check | Result |
| --- | --- |
| `pnpm exec tsc --noEmit` | Pass |
| `pnpm exec eslint .` | Pass |
| `pnpm exec next build` | Pass, 28 routes, proxy registered |
| `pnpm exec tsx scripts/verify-fixtures.ts` | Pass, 10 eval rows, banned words absent |
| `node scripts/contrast.mjs` | Pass, lowest pair 6.22 |
| Playwright | 13 passed, one worker, Chromium |
| axe serious or critical | None on `/chat`, `/admin/queue`, `/super-admin` |
| External requests during faculty chat | None |
| Viewports | Chat overflow check passed at 390 and 1280 |
| Screenshots | `docs/screens/` |

Sample accounts, password `123456`: `faculty`, `admin`, `superadmin`.

Dev server: `pnpm dev` then `http://127.0.0.1:3100/login`.
