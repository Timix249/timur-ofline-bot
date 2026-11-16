import { mkdir, readFile, writeFile } from "node:fs/promises";

const TELEGRAM = "https://api.telegram.org";
const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";
const REACTIONS = new Set(["👍", "👎", "❤", "🔥", "🎉", "😢", "🤔", "👏", "🤩", "🙏", "👌", "💯"]);
const stateFile = new URL("./data/offset.json", import.meta.url);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

const token = required("TELEGRAM_BOT_TOKEN");
const geminiKey = required("GEMINI_API_KEY");
const allowedChats = new Set(
  (process.env.ALLOWED_CHAT_IDS || "").split(",").map((id) => id.trim()).filter(Boolean),
);
const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

async function telegram(method, body) {
  const response = await fetch(`${TELEGRAM}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(`Telegram ${method}: ${data.description || response.status}`);
  return data.result;
}

async function base64(bytes) {
  return Buffer.from(await bytes.arrayBuffer()).toString("base64");
}

async function photoPart(photos) {
  const photo = photos?.at(-1);
  if (!photo?.file_id) return null;
  const file = await telegram("getFile", { file_id: photo.file_id });
  if (!file.file_path) return null;
  const download = await fetch(`${TELEGRAM}/file/bot${token}/${file.file_path}`);
  if (!download.ok || Number(download.headers.get("content-length") || 0) > 8 * 1024 * 1024) return null;
  return { inline_data: { mime_type: "image/jpeg", data: await base64(download) } };
}

function parseEmoji(text) {
  try {
    const emoji = JSON.parse(text)?.emoji;
    return REACTIONS.has(emoji) ? emoji : null;
  } catch { return null; }
}

async function chooseEmoji(message) {
  const parts = [{
    text: `Choose a reaction only if clearly appropriate. Return JSON only: {"emoji":"one item"} or {"emoji":null}. Allowed: ${[...REACTIONS].join(" ")}. Do not react to routine questions, logistics, unclear content, spam, or sensitive/distressing material.`,
  }];
  const text = message.text || message.caption;
  if (text) parts.push({ text: `Message: ${text.slice(0, 4000)}` });
  const photo = await photoPart(message.photo);
  if (photo) parts.push(photo);
  if (parts.length === 1) return null;

  const response = await fetch(`${GEMINI}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
    body: JSON.stringify({
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
      contents: [{ role: "user", parts }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Gemini: ${data.error?.message || response.status}`);
  return parseEmoji(data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "");
}

async function loadOffset() {
  try { return JSON.parse(await readFile(stateFile, "utf8")).offset || 0; } catch { return 0; }
}

async function saveOffset(offset) {
  await mkdir(new URL("./data/", import.meta.url), { recursive: true });
  await writeFile(stateFile, JSON.stringify({ offset }));
}

async function handle(message) {
  if (!message?.chat?.id || !allowedChats.has(String(message.chat.id))) return;
  const emoji = await chooseEmoji(message);
  if (emoji) await telegram("setMessageReaction", {
    chat_id: message.chat.id,
    message_id: message.message_id,
    reaction: [{ type: "emoji", emoji }],
    is_big: false,
  });
}

async function run() {
  if (allowedChats.size === 0) console.warn("No ALLOWED_CHAT_IDS set: the bot will not react in any chat.");
  let offset = await loadOffset();
  for (;;) {
    try {
      const updates = await telegram("getUpdates", { offset, timeout: 50, allowed_updates: ["message"] });
      for (const update of updates) {
        offset = update.update_id + 1;
        try { await handle(update.message); } catch (error) { console.error("Update failed:", error.message); }
        await saveOffset(offset);
      }
    } catch (error) {
      console.error("Polling failed:", error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

run().catch((error) => { console.error(error); process.exit(1); });
