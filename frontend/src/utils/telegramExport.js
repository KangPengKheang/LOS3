// ─────────────────────────────────────────────────────────────────────────
// Telegram export helper
//
// Sends a generated PDF (as a jsPDF document) to a Telegram group/channel
// using a Telegram Bot.
//
// SETUP REQUIRED:
// 1. Create a bot via https://t.me/BotFather and copy the bot token.
// 2. Add the bot to your destination Telegram group/channel.
// 3. Get the chat id of that group (e.g. message @RawDataBot in the group,
//    or use https://api.telegram.org/bot<token>/getUpdates after sending
//    a message in the group). Group chat ids are usually negative numbers
//    (e.g. -1001234567890).
// 4. Fill in TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID below, or set them via
//    Vite env variables (VITE_TELEGRAM_BOT_TOKEN / VITE_TELEGRAM_CHAT_ID)
//    in frontend/.env.
// ─────────────────────────────────────────────────────────────────────────

const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '8819009430:AAHuKD6KjNz3j4VeYJCGjr7AbzOG94ubBH8';
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID || '-5247490437';

/**
 * Sends a jsPDF document instance to the configured Telegram chat as a document.
 *
 * @param {import('jspdf').jsPDF} doc - The jsPDF document to send.
 * @param {string} filename - Filename to use for the PDF (e.g. "LOS_Branch_Workflow_20260101to20260131.pdf").
 * @param {string} [caption] - Optional caption text shown with the document in Telegram.
 * @returns {Promise<void>}
 */
export async function sendPdfToTelegram(doc, filename, caption = '') {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    throw new Error('Telegram bot token is not configured. Set VITE_TELEGRAM_BOT_TOKEN in frontend/.env');
  }
  if (!TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID === 'YOUR_CHAT_ID_HERE') {
    throw new Error('Telegram chat id is not configured. Set VITE_TELEGRAM_CHAT_ID in frontend/.env');
  }

  // Get the PDF as a Blob from jsPDF
  const pdfBlob = doc.output('blob');

  const formData = new FormData();
  formData.append('chat_id', TELEGRAM_CHAT_ID);
  if (caption) formData.append('caption', caption);
  formData.append('document', pdfBlob, filename);

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.description || 'Failed to send document to Telegram');
  }

  return result;
}
