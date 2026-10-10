// workers/post/src/announcement.ts
// One-time editor's notes sent to every active subscriber through the daily
// run. The copy below is the approved text; edit it only with sign-off.
import { escapeHtml, shell, type EmailContext, type RenderedEmail } from './email';
import type { Program } from './types';

export interface Announcement {
  /** Delivery-record key; never reuse an id for different copy. */
  id: string;
  /** ISO date of the one daily run that sweeps subscribers; never earlier. */
  sendOn: string;
  render(program: Program, ctx: EmailContext): RenderedEmail;
}

const P = '<p style="font-size:15px;line-height:1.6;">';

const AIH_SUBJECT = 'The Debate Begins Again on October 18';

const AIH_INTRO_HTML = `
<p style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6E6353;font-family:Arial,sans-serif;">A Note from the Editor. Sunday, October 11, 2026.</p>
<h1 style="font-size:20px;text-align:center;font-weight:600;margin:14px 0 4px;">The Debate Begins Again on October 18</h1>
<p style="text-align:center;font-style:italic;color:#6E6353;margin-top:0;">To the Readers of Federalist Reader.</p>
<div style="font-style:italic;color:#6E6353;font-size:14px;margin:16px 0;text-align:center;">Starting October 18, As It Happened delivers both sides of the ratification debate on the anniversaries of their original publication.</div>
${P}A quick note before something I’ve been looking forward to all year.</p>${P}On October 18, 1787, a New York newspaper printed an essay signed “Brutus.” It warned that the proposed Constitution would swallow the states and create a government too large to answer to its people. It was one of the sharpest opening shots in the ratification fight, and Publius spent the following months answering it.</p>${P}Starting October 18, Federalist Reader’s “As It Happened” season puts that argument back in your inbox on its original calendar. Each essay arrives on the anniversary of its first publication, from both sides of the debate. Brutus No. I comes first, and Federalist No. 1 follows on October 27. The season runs through April 26.</p>`;

const AIH_OUTRO_HTML = `
${P}In the spirit of 1787, when these essays passed from hand to hand and paper to paper, pass this one along. If you know someone who&rsquo;d enjoy reading the debate as it unfolded, forward this note or send them to <a href="https://federalistreader.org/subscribe/" style="color:#1F6B66;">federalistreader.org/subscribe</a>. It&rsquo;s free, and both sides arrive on their original dates.</p><p style="text-align:center;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6E6353;margin:18px 0;">Share: <a href="mailto:?subject=The%20ratification%20debate%2C%20as%20it%20happened&body=I%20thought%20you%27d%20enjoy%20this.%20Federalist%20Reader%20is%20emailing%20both%20sides%20of%20the%201787%20ratification%20debate%20on%20their%20original%20dates%2C%20starting%20October%2018%20with%20Brutus%20No.%20I.%20It%27s%20free%3A%20https%3A//federalistreader.org/subscribe/" style="color:#1F6B66;text-decoration:none;">Email a friend</a> &middot; <a href="https://twitter.com/intent/tweet?text=Reading%20the%201787%20ratification%20debate%20as%20it%20happened%2C%20both%20sides%20on%20their%20original%20dates%2C%20starting%20Oct%2018%20with%20Brutus%20No.%20I.&url=https%3A//federalistreader.org/subscribe/" style="color:#1F6B66;text-decoration:none;">X</a> &middot; <a href="https://www.facebook.com/sharer/sharer.php?u=https%3A//federalistreader.org/subscribe/" style="color:#1F6B66;text-decoration:none;">Facebook</a></p>${P}Thanks for reading along. It’s a pleasure to have you here.</p>
<p style="font-size:15px;line-height:1.6;margin-bottom:0;">Publius</p>`;

/** Calendar readers already get the season, so they get no switch section. */
function aihSwitchHtml(program: Program, ctx: EmailContext): string {
  if (program === 'calendar') return '';
  return `${P}If you’re on the Weekly Course, nothing changes for you. You’ll keep getting one paper a week. If you’d like to follow the debate as it unfolded instead, you can switch here:</p>
<p style="text-align:center;margin:22px 0;"><a href="${escapeHtml(ctx.manageUrl)}" style="background:#1F6B66;color:#F4EFE2;font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:12px 22px;display:inline-block;">Switch to As It Happened</a></p>`;
}

function aihText(program: Program, ctx: EmailContext): string {
  const switchText = program === 'calendar'
    ? ''
    : `If you’re on the Weekly Course, nothing changes for you. You’ll keep getting one paper a week. If you’d like to follow the debate as it unfolded instead, you can switch here: ${ctx.manageUrl}\n\n`;
  return `A Note from the Editor. Sunday, October 11, 2026.

The Debate Begins Again on October 18
To the Readers of Federalist Reader.

Starting October 18, As It Happened delivers both sides of the ratification debate on the anniversaries of their original publication.

A quick note before something I’ve been looking forward to all year.

On October 18, 1787, a New York newspaper printed an essay signed “Brutus.” It warned that the proposed Constitution would swallow the states and create a government too large to answer to its people. It was one of the sharpest opening shots in the ratification fight, and Publius spent the following months answering it.

Starting October 18, Federalist Reader’s “As It Happened” season puts that argument back in your inbox on its original calendar. Each essay arrives on the anniversary of its first publication, from both sides of the debate. Brutus No. I comes first, and Federalist No. 1 follows on October 27. The season runs through April 26.

${switchText}In the spirit of 1787, when these essays passed from hand to hand and paper to paper, pass this one along. If you know someone who'd enjoy reading the debate as it unfolded, forward this note or send them to https://federalistreader.org/subscribe/. It's free, and both sides arrive on their original dates.

Share by email: mailto:?subject=The%20ratification%20debate%2C%20as%20it%20happened&body=I%20thought%20you%27d%20enjoy%20this.%20Federalist%20Reader%20is%20emailing%20both%20sides%20of%20the%201787%20ratification%20debate%20on%20their%20original%20dates%2C%20starting%20October%2018%20with%20Brutus%20No.%20I.%20It%27s%20free%3A%20https%3A//federalistreader.org/subscribe/
Share on X: https://twitter.com/intent/tweet?text=Reading%20the%201787%20ratification%20debate%20as%20it%20happened%2C%20both%20sides%20on%20their%20original%20dates%2C%20starting%20Oct%2018%20with%20Brutus%20No.%20I.&url=https%3A//federalistreader.org/subscribe/
Share on Facebook: https://www.facebook.com/sharer/sharer.php?u=https%3A//federalistreader.org/subscribe/

Thanks for reading along. It’s a pleasure to have you here.

Publius

Manage: ${ctx.manageUrl}
Unsubscribe: ${ctx.unsubscribeUrl}
${ctx.postalAddress}`;
}

/** The As It Happened season heads-up, one week before Brutus No. I. */
export const AIH_SEASON_ANNOUNCEMENT: Announcement = {
  id: 'aih-season-2026',
  sendOn: '2026-10-11',
  render(program, ctx) {
    return {
      subject: AIH_SUBJECT,
      html: shell(AIH_INTRO_HTML + aihSwitchHtml(program, ctx) + AIH_OUTRO_HTML, ctx),
      text: aihText(program, ctx)
    };
  }
};
