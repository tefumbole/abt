/**
 * Serial WhatsApp send queue — Wasender account protection allows ~1 message / 5s.
 * All send-message calls go through this queue so concurrent requests never collide.
 */

const MIN_INTERVAL_MS = Number(process.env.WASENDER_MIN_SEND_INTERVAL_MS || 6000);
const TEXT_TO_DOCUMENT_DELAY_MS = Number(process.env.WASENDER_TEXT_TO_DOCUMENT_DELAY_MS || 6000);

let lastSendAt = 0;
let chain = Promise.resolve();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitMessage(message) {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('account protection')
    || text.includes('every 5 seconds')
    || text.includes('rate limit')
    || text.includes('retry_after')
  );
}

function getRetryAfterMs(result) {
  const seconds = Number(result?.data?.retry_after ?? result?.retry_after);
  if (Number.isFinite(seconds) && seconds > 0) {
    // Wasender account protection is typically 5s; add buffer so retries don't bounce again
    return Math.max(Math.ceil(seconds * 1000) + 750, MIN_INTERVAL_MS);
  }
  return Math.max(MIN_INTERVAL_MS, 6500);
}

async function waitForSendSlot(label) {
  const elapsed = Date.now() - lastSendAt;
  if (lastSendAt > 0 && elapsed < MIN_INTERVAL_MS) {
    const wait = MIN_INTERVAL_MS - elapsed;
    console.log(`[WASENDER-QUEUE] Waiting ${wait}ms before ${label}`);
    await sleep(wait);
  }
}

/**
 * Run a Wasender send-message operation with global rate limiting and optional retry.
 * @param {string} label
 * @param {() => Promise<object>} sendFn must return { success, error, data, ... }
 */
export function runQueuedWhatsAppSend(label, sendFn) {
  const job = chain.then(async () => {
    await waitForSendSlot(label);

    let result = await sendFn();

    if (!result?.success) {
      const errText = result?.error || result?.data?.message || '';
      if (isRateLimitMessage(errText)) {
        const waitMs = getRetryAfterMs(result);
        console.warn(`[WASENDER-QUEUE] Rate limited on ${label}, retrying after ${waitMs}ms`);
        await sleep(waitMs);
        await waitForSendSlot(`${label}-retry`);
        result = await sendFn();
      }
    }

    lastSendAt = Date.now();
    return result;
  });

  chain = job.catch((err) => {
    console.error('[WASENDER-QUEUE] Job failed:', err?.message || err);
  });

  return job;
}

export function getTextToDocumentDelayMs() {
  return TEXT_TO_DOCUMENT_DELAY_MS;
}

export function getMinSendIntervalMs() {
  return MIN_INTERVAL_MS;
}
