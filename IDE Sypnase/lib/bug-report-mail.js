'use strict';

const mailProviderUrl = 'https://api.resend.com/emails';
const maximumDetailCharacters = 400;

async function deliver(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs);
  try {
    const response = await fetch(mailProviderUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${request.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
            from: request.sender,
            to: [request.recipient],
            reply_to: request.replyTo || undefined,
            subject: request.subject,
            text: request.text,
        }),
        signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text();
      return {
        delivered: false,
        status: response.status,
        detail: detail.slice(0, maximumDetailCharacters),
      };
    }
    return { delivered: true, status: response.status, detail: '' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { mailProviderUrl, deliver };
