# LifeLine — Real-Time Blood Bank Demand Matching

A college project prototype that connects hospitals, donors and blood banks through a blood-group
compatibility and scoring engine. It uses fictional demo data and is **not a medical device**.

## Tech stack
Next.js (App Router) · React · TypeScript · Tailwind CSS · Supabase (Auth + data) · Google OAuth · Leaflet / React-Leaflet · Zod

## Features
- Hospital, donor and blood-bank portals
- Matching engine: ABO/Rh compatibility filter, then weighted scoring (urgency 35%, proximity 30%, expiry 20%, reliability 15%), then first-confirmed lock
- Rapid Blood Finder with 7-stage request tracking, and Unit Passport
- Cinematic one-click intro: Home → How It Works → For Donors → Rapid Delivery
- Animated Analytics and a constellation-style Live Demo (demo data, clearly labelled)

## Run locally
```bash
npm install
cp .env.example .env.local   # then add your Supabase URL and anon key
npm run dev
```
Open http://localhost:3000

On Windows PowerShell use `npm.cmd` instead of `npm`, and copy the env file manually.

## Notes
- Inventory, donors and requests shown in the demo are fictional and stored in the browser.
- Real-world delivery tracking and an AI Copilot are **not** implemented (the Copilot section is a labelled concept).
