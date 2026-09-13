# Pulse

Anonymous surveys for team meetups. Write a few questions, put a QR code on the screen, the team scans and answers from their phones, and you review the answers together live.

Built with Next.js (App Router) and Supabase.

## How it works

- **Create** a survey on the home page. You get a short code and a private host link. Question types: open answer, open answer with name (not anonymous), scale with any range up to 0 to 10, pick one, and content slides that show text without asking anything. The home page starts with the Rendy meetup question set from `src/lib/starter.ts`.
- **Share** the QR code from the host page. It points to `/s/<code>`.
- **Answer** from any phone. No login. No name, email, or device identifier is stored with a response.
- **Review** on the host page. Results poll every few seconds. Close the survey when you start discussing.

Host links carry a secret key in the URL (`?k=...`) and are also remembered in the host's browser under "Your surveys on this device".

## Setup

1. Create a Supabase project.
2. Open the SQL editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local` and fill in your project URL and publishable key (Project Settings → API Keys).
4. Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Security model

Both tables have row level security enabled with no policies, so the publishable key cannot read or write them directly. All access goes through `security definer` functions:

| Function | Who | Does |
| --- | --- | --- |
| `create_survey` | anyone | Creates a survey, returns code + host key |
| `get_survey` | anyone with the code | Reads questions only |
| `submit_response` | anyone with the code | Inserts an anonymous answer while the survey is open |
| `get_results` | host key required | Reads all responses |
| `set_survey_status` | host key required | Opens or closes the survey |
| `delete_survey` | host key required | Deletes the survey and its answers |

## Deploy

Deploy to Vercel (or any Node host) and set the two `NEXT_PUBLIC_SUPABASE_*` environment variables. The QR code uses the page's own origin, so it works on any domain without configuration.
