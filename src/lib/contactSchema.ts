// src/lib/contactSchema.ts
// One validation source for the contact form (client) and /api/contact (server).

export interface ContactInput {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export type ContactField = keyof ContactInput;
export type ContactErrors = Partial<Record<ContactField, string>>;

export const CONTACT_LIMITS = {
  name: { min: 2, max: 100 },
  email: { max: 254 },
  phone: { max: 30 },
  subject: { min: 3, max: 150 },
  message: { min: 10, max: 5000 },
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\d\s.-]{6,30}$/;

export function validateField(field: ContactField, raw: string | undefined): string | undefined {
  const value = (raw ?? '').trim();
  switch (field) {
    case 'name':
      if (!value) return 'Please enter your name.';
      if (value.length < CONTACT_LIMITS.name.min) return 'Your name looks a little short.';
      if (value.length > CONTACT_LIMITS.name.max) return `Keep your name under ${CONTACT_LIMITS.name.max} characters.`;
      return undefined;
    case 'email':
      if (!value) return 'Please enter your email address.';
      if (value.length > CONTACT_LIMITS.email.max || !EMAIL_RE.test(value)) return 'That email address doesn’t look right.';
      return undefined;
    case 'phone':
      if (!value) return undefined;
      return PHONE_RE.test(value) ? undefined : 'Use digits, spaces, + or - only.';
    case 'subject':
      if (!value) return 'Please add a subject.';
      if (value.length < CONTACT_LIMITS.subject.min) return 'Subject is a little short.';
      if (value.length > CONTACT_LIMITS.subject.max) return `Keep the subject under ${CONTACT_LIMITS.subject.max} characters.`;
      return undefined;
    case 'message':
      if (!value) return 'Tell me a little about what you need.';
      if (value.length < CONTACT_LIMITS.message.min) return `Add a few more details (at least ${CONTACT_LIMITS.message.min} characters).`;
      if (value.length > CONTACT_LIMITS.message.max) return `Keep the message under ${CONTACT_LIMITS.message.max} characters.`;
      return undefined;
  }
}

export function validateContact(input: Partial<Record<ContactField, unknown>>): {
  ok: boolean;
  errors: ContactErrors;
  data: ContactInput;
} {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const data: ContactInput = {
    name: str(input.name),
    email: str(input.email),
    phone: str(input.phone),
    subject: str(input.subject),
    message: str(input.message),
  };
  const errors: ContactErrors = {};
  (['name', 'email', 'phone', 'subject', 'message'] as ContactField[]).forEach((field) => {
    const error = validateField(field, data[field]);
    if (error) errors[field] = error;
  });
  return { ok: Object.keys(errors).length === 0, errors, data };
}
