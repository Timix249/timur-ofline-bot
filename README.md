# TimurLittleFamilyBot

Long-polling Telegram bot. In private chats it converses in Ukrainian and analyzes photos with Gemini. In approved groups it sends only appropriate emoji reactions.

## Required Cloud secrets

- `TELEGRAM_BOT_TOKEN`
- `GEMINI_API_KEY`
- `ALLOWED_CHAT_IDS` — comma-separated test/approved Telegram group IDs. Empty means no group reactions; private chats still work.

Optional: `GEMINI_MODEL` (defaults to `gemini-2.0-flash`).

## Run

```bash
npm start
```

The process uses Telegram long polling, so it does not need Cloudflare or a public webhook. Do not configure a webhook for this bot while long polling is active.
