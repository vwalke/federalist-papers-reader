// workers/post/src/resend.ts
export interface OutboundEmail {
  from: string; to: string; subject: string; html: string; text: string;
  unsubscribeUrl: string;
}

export async function sendEmail(apiKey: string, mail: OutboundEmail): Promise<string> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: mail.from, to: [mail.to], subject: mail.subject,
      html: mail.html, text: mail.text,
      headers: {
        'List-Unsubscribe': `<${mail.unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
    })
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
  const data = (await response.json()) as { id: string };
  return data.id;
}
