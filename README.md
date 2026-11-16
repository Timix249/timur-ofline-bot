# TimurLittleFamilyBot

Long-polling Telegram reaction bot. It analyzes text and photos with Gemini and sends only appropriate emoji reactions.

## Required Cloud secrets

- `TELEGRAM_BOT_TOKEN`
- `GEMINI_API_KEY`
- `ALLOWED_CHAT_IDS` — comma-separated test/approved Telegram chat IDs. Empty means no reactions anywhere.

Optional: `GEMINI_MODEL` (defaults to `gemini-2.0-flash`).

## Run

```bash
npm start
```

The process uses Telegram long polling, so it does not need Cloudflare or a public webhook. Do not configure a webhook for this bot while long polling is active.
