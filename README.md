# SpamTrack ⚖️

A Hebrew RTL case management system for filing spam lawsuit claims under Section 30A of Israel's Communications Law (Amendment 40, 2008).

## What it does

SpamTrack automates the full pipeline for managing unsolicited message lawsuits:
- **Evidence capture** — log spam messages received via email or SMS
- **Case management** — Kanban-style pipeline from evidence → opt-out → pre-legal → negotiation → settlement/court
- **Document generation** — one-click legal warning letters and court-ready lawsuit drafts
- **Settlement tracking** — built-in stats dashboard tracking total claims and settlements

## Legal basis

Claims are filed under **סעיף 30א לחוק הטלקומוניקציה (בזק ושירותים), תשמ"ב-1982** (Israel Spam Law).

Formula: **₪1,000 per violation** + ₪2,000 court costs.

Case law referenced: רע"א 1954/14, רע"א 2904/14, ת"ק 44069-09-14, ת"ץ 61428-12-23.

## Tech stack

- **Frontend:** React + Vite
- **Auth:** Firebase Authentication (Google Sign-In)
- **Database:** Firebase Firestore
- **Hosting:** Firebase Hosting
- **CI/CD:** GitHub Actions → auto-deploy on push to `main`

## Live app

🔗 [spam-track.web.app](https://spam-track.web.app)

## Local development

```bash
npm install
npm run dev
```

## Deploy

Deployments are automatic via GitHub Actions on every push to `main`.

Manual deploy:
```bash
npm run build
firebase deploy
```

## Project structure