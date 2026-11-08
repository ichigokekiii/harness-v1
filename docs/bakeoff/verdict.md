# Composition verdict

Four static studies are in `bakeoff/` and `docs/screens/`. They were built as separate files. They were not given each other's layouts.

| Study | Layout I asked for |
| --- | --- |
| impeccable | Cursor rail, 720px column, docked composer, navy tool dock |
| editorial | Narrow login, thin index, agent as a bottom sheet |
| dock | 56px icon rail and a full-width transcript |
| paper | White cards, one card per message |

The shipped app follows the impeccable study plus the Figma wireframe. Chat uses the left thread list, the centered column, and the composer with `9B Heretic` in the row. Space uses Agent, Library, and Layers, the dotted canvas, the inspector, and the navy tool dock. Admin queue is a table with confidence and status words.

I did not run a second model to assign rubric numbers. The screenshots are the evidence. Playwright covered login, citation, upload, approve, undo, CSV, both widths, axe, and the no-network check. Those passed on 9 Nov 2026.

This run was told to finish every role, so the look above is the one in `src/`. A different study can still replace the shell. The domain types and `/api/harness` routes would stay.
