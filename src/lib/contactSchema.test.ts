import { describe, expect, it } from 'vitest';
import { validateContact, validateField } from './contactSchema';

const valid = { name: 'Ada Lovelace', email: 'ada@example.com', subject: 'Hello there', message: 'I would like to talk about a project.' };

describe('contact validation', () => {
  it('accepts a complete, valid message and trims it', () => {
    const r = validateContact({ ...valid, name: '  Ada Lovelace  ' });
    expect(r.ok).toBe(true);
    expect(r.data.name).toBe('Ada Lovelace');
  });

  it('flags every missing required field', () => {
    const r = validateContact({});
    expect(Object.keys(r.errors).sort()).toEqual(['email', 'message', 'name', 'subject']);
  });

  it('rejects bad emails, odd phones and over-long text', () => {
    expect(validateField('email', 'not-an-email')).toBeDefined();
    expect(validateField('email', 'a@b')).toBeDefined();
    expect(validateField('email', 'a@b.co')).toBeUndefined();
    expect(validateField('phone', 'abc')).toBeDefined();
    expect(validateField('phone', '')).toBeUndefined();
    expect(validateField('phone', '+268 7934 2380')).toBeUndefined();
    expect(validateField('message', 'x'.repeat(5001))).toBeDefined();
    expect(validateField('name', 'x'.repeat(101))).toBeDefined();
  });

  it('ignores non-string input instead of throwing', () => {
    const r = validateContact({ name: 5, email: null, subject: {}, message: [] });
    expect(r.ok).toBe(false);
  });
});
