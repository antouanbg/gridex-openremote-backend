import { randomInt, randomUUID, createHash } from 'node:crypto';
import { ApiError } from './errors.mjs';
import { mailgunConfig, sendMailgun } from './mailgun.mjs';

const emailPattern = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const digest = value => createHash('sha256').update(value).digest('hex');

export class ContactInquiries {
  constructor({ recipient, cc, mailgun = mailgunConfig, send = sendMailgun, now = () => Date.now(), random = randomInt } = {}) {
    this.recipient = recipient;
    this.cc = cc;
    this.mailgun = mailgun;
    this.send = send;
    this.now = now;
    this.random = random;
    this.challenges = new Map();
    this.sent = new Map();
    this.issued = [];
  }

  challenge() {
    const now = this.now();
    this.issued = this.issued.filter(time => now - time < 60_000);
    for (const [id, item] of this.challenges) if (item.expiresAt < now) this.challenges.delete(id);
    if (this.issued.length >= 120 || this.challenges.size >= 1000)
      throw new ApiError(429, 'contact_busy', 'Please try again later.');
    this.issued.push(now);
    const left = this.random(2, 10);
    const right = this.random(2, 10);
    const id = randomUUID();
    this.challenges.set(id, { answer: left + right, issuedAt: now, expiresAt: now + 10 * 60_000 });
    return { id, left, right, expiresInSeconds: 600 };
  }

  async submit(body, identity = null) {
    const challenge = this.challenges.get(body?.challengeId);
    if (challenge) this.challenges.delete(body.challengeId); // One attempt, including failures.
    const now = this.now();
    if (!challenge || now < challenge.issuedAt + 2_000 || now > challenge.expiresAt
        || body.answer !== challenge.answer)
      throw new ApiError(400, 'contact_challenge_invalid', 'Please complete the human check again.');
    if (body.website) return { status: 'queued' }; // Honeypot: no email is sent.
    const name = String(body.name || '').trim();
    const topic = String(body.topic || '').trim();
    const message = String(body.message || '').trim();
    const email = identity ? String(identity.email || '').trim().toLowerCase() : String(body.email || '').trim().toLowerCase();
    if (identity && !identity.emailVerified) throw new ApiError(403, 'email_unverified', 'A verified email is required.');
    if (!emailPattern.test(email) || name.length < 2 || name.length > 100 || /[\r\n]/.test(name)
        || topic.length < 3 || topic.length > 120 || /[\r\n]/.test(topic)
        || message.length < 20 || message.length > 5000)
      throw new ApiError(400, 'contact_invalid', 'Check the form fields and try again.');
    if (!emailPattern.test(this.recipient || '') || !emailPattern.test(this.cc || ''))
      throw new ApiError(503, 'contact_unavailable', 'Enquiries are temporarily unavailable.');
    const key = digest(email);
    for (const [id, time] of this.sent) if (now - time >= 3_600_000) this.sent.delete(id);
    if (this.sent.size >= 30 || (this.sent.get(key) && now - this.sent.get(key) < 300_000))
      throw new ApiError(429, 'contact_rate_limited', 'Please wait before sending another enquiry.');
    // Reserve before the network call: uncertain provider timeouts must not trigger a duplicate send.
    this.sent.set(key, now);
    try {
      const scope = identity ? `Signed-in user · realm: ${identity.realm} · subject: ${identity.subject}` : 'Public demo visitor';
      const result = await this.send(this.mailgun(), {
        to: this.recipient, cc: this.cc, subject: `[GrideX] ${topic}`,
        text: `New GrideX enquiry\n\nName: ${name}\nEmail: ${email}\nSource: ${scope}\n\n${message}`,
      });
      return { status: result.status === 'queued' ? 'queued' : 'accepted' };
    } catch {
      throw new ApiError(503, 'contact_delivery_unknown', 'The delivery status is unknown. Please contact support before retrying.');
    }
  }
}
