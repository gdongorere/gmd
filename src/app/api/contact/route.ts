// src/app/api/contact/route.ts
// Public contact endpoint. It only accepts new messages: reading or editing stored
// messages is done in Sanity Studio, never through a public URL.
import { NextRequest, NextResponse } from 'next/server';
import { getWriteClient } from '@/lib/sanity.server';
import { validateContact } from '@/lib/contactSchema';

export const dynamic = 'force-dynamic';

// Best-effort rate limit: per server instance, so it blunts floods rather than guaranteeing a cap.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [key, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
  }
  return recent.length > MAX_PER_WINDOW;
}

const json = (body: Record<string, unknown>, status: number, headers?: Record<string, string>) =>
  NextResponse.json(body, { status, headers });

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';

  if (rateLimited(ip)) {
    return json({ message: 'Too many messages. Please try again in a few minutes.' }, 429, { 'Retry-After': '600' });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('bad body');
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ message: 'Invalid request.' }, 400);
  }

  // Honeypot: real visitors never see this field. Pretend success so bots learn nothing.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return json({ message: 'Message sent.' }, 200);
  }

  const { ok, errors, data } = validateContact(body);
  if (!ok) {
    return json({ message: 'Please check the highlighted fields.', errors }, 400);
  }

  try {
    await getWriteClient().create({
      _type: 'contact',
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      subject: data.subject,
      message: data.message,
      sentAt: new Date().toISOString(),
      status: 'new',
    });
    return json({ message: 'Message sent.' }, 200);
  } catch (error) {
    console.error('Contact submission failed:', error instanceof Error ? error.message : error);
    return json({ message: 'Something went wrong on my side. Please email me directly instead.' }, 500);
  }
}
