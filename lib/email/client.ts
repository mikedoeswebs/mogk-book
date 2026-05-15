/**
 * SMTP2GO HTTP API wrapper. Uses fetch so it works cleanly on Vercel Functions
 * without holding SMTP sockets open across invocations.
 */

type SendArgs = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const ENDPOINT = 'https://api.smtp2go.com/v3/email/send';

export function getFromAddress(): string {
  return process.env.EMAIL_FROM ?? 'mike@mogoalkeeping.co.uk';
}

export async function sendEmail({ to, subject, text, html }: SendArgs): Promise<void> {
  const apiKey = process.env.SMTP2GO_API_KEY;

  if (!apiKey) {
    console.warn(`[email] SMTP2GO_API_KEY not set - would send to ${to}: ${subject}`);
    return;
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Smtp2go-Api-Key': apiKey,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: getFromAddress(),
      to: [to],
      subject,
      text_body: text,
      html_body: html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`SMTP2GO send failed (${response.status}): ${body}`);
  }

  const result = (await response.json().catch(() => null)) as {
    data?: { succeeded?: number; failed?: number; failures?: unknown[] };
  } | null;

  if (result?.data && result.data.failed && result.data.failed > 0) {
    throw new Error(`SMTP2GO reported failures: ${JSON.stringify(result.data.failures ?? [])}`);
  }
}
