# IP Code Exchange — Commercialization Engine 4.2.0

A deployable AI-assisted workflow for turning software and other technical IP into commercial opportunities.

Pipeline:

IP asset -> analysis -> screening valuation -> licensing paths -> buyer categories -> outreach

## Run locally

```bash
npm install
npm run dev
```

Optional environment variables:

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

Without an OpenAI key, the application uses a deterministic screening fallback so the product remains demonstrable. With a key, the commercialization endpoint uses the configured OpenAI model.

## Deploy

This repository is Next.js/Vercel-ready. Import the repository into Vercel and add `OPENAI_API_KEY` for live AI analysis.

The current 4.2.0 ship intentionally keeps the product surface small: one asset enters and a commercialization brief comes out. Buyer discovery is a lead-generation aid and requires human verification; valuation is a screening estimate, not a formal appraisal.
