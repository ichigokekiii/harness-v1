# Harness v1 design

## Intent

A faculty member at Sample Academy finds a cited page, builds a lesson board, and an admin admits a scan. The super admin can see the institution, the audit, and whether the local services are up.

## Goals

Every role can sign in and finish its loop on sample data. Light and dark themes share one spacing system. A FastAPI client can replace login and chat later.

## Non-goals

No cloud model, consent, credits, real school records, or a second product name in the fixtures.

## Constraints

Next.js 16, React 19, Tailwind v4, sample data behind `/api/harness`. Password `123456` for `faculty`, `admin`, and `superadmin`.

## Approaches

1. Copy the old prototype and restyle it. Rejected. The old shell, cloud consent, and baby-blue tokens would come along.
2. Four full apps, then a rebuild. The studies in `bakeoff/` compare composition. The shipped app is one system so the tokens and routes stay shared.
3. One app, DOM canvas, HMAC session. Chosen. It runs with no license key and no Google client id, and the text on a frame stays real text.

## Builder calls

The page viewer is HTML. Gold is only the active tool on the navy dock. Faculty can mark the model offline from the composer so the search-only banner is reachable. Participant id on the eval is optional.
