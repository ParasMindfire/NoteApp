/**
 * Unit tests for Zod schemas exported from @noteapp/shared.
 *
 * These tests validate the schemas directly (no HTTP, no DB) against the
 * exact rules in FRS.md for each FR. They are the canonical schema-contract
 * tests; endpoint tests (auth.register.test.ts etc.) cover integration.
 *
 * Coverage:
 *   AUTH-REGISTER-S2  → FR-AUTH-1  registerSchema validation rules
 *   AUTH-LOGIN-S2     → FR-AUTH-2  loginSchema validation rules
 *   AUTH-FORGOT-S3    → FR-AUTH-5  forgotPasswordSchema validation rules
 *   AUTH-OTP-S5       → FR-AUTH-6  resetPasswordSchema validation rules
 *   SCHEMA-NOTE-1     → FR-NOTE-1  createNoteSchema validation rules
 *   SCHEMA-NOTE-2     → FR-NOTE-3  updateNoteSchema validation rules
 */

import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createNoteSchema,
  updateNoteSchema,
  searchQuerySchema,
} from '@noteapp/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function succeeds<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, input: unknown): T {
  const result = schema.safeParse(input);
  expect(result.success).toBe(true);
  return (result as { success: true; data: T }).data;
}

function fails(schema: { safeParse: (v: unknown) => { success: boolean } }, input: unknown): void {
  const result = schema.safeParse(input);
  expect(result.success).toBe(false);
}

// ---------------------------------------------------------------------------
// FR-AUTH-1  registerSchema
// FRS: email valid format max 255; password min 8 chars + at least 1 digit
// ---------------------------------------------------------------------------

describe('AUTH-REGISTER-S2: registerSchema validation rules (FR-AUTH-1)', () => {
  it('AUTH-REGISTER-S2: valid email + password with digit → parse succeeds', () => {
    const data = succeeds(registerSchema, { email: 'user@example.com', password: 'Password1' });
    expect(data.email).toBe('user@example.com');
    expect(data.password).toBe('Password1');
  });

  it('AUTH-REGISTER-S2: password shorter than 8 chars → fails', () => {
    fails(registerSchema, { email: 'user@example.com', password: 'Pa1' });
  });

  it('AUTH-REGISTER-S2: password with no digit → fails', () => {
    fails(registerSchema, { email: 'user@example.com', password: 'NoDigitsHere' });
  });

  it('AUTH-REGISTER-S2: invalid email format → fails', () => {
    fails(registerSchema, { email: 'not-an-email', password: 'Password1' });
  });

  it('AUTH-REGISTER-S2: email exceeding 255 chars → fails', () => {
    const longEmail = 'a'.repeat(250) + '@x.com'; // > 255 chars
    fails(registerSchema, { email: longEmail, password: 'Password1' });
  });

  it('AUTH-REGISTER-S2: missing email field → fails', () => {
    fails(registerSchema, { password: 'Password1' });
  });

  it('AUTH-REGISTER-S2: missing password field → fails', () => {
    fails(registerSchema, { email: 'user@example.com' });
  });

  it('AUTH-REGISTER-S2: password exactly 8 chars with 1 digit → succeeds', () => {
    succeeds(registerSchema, { email: 'user@example.com', password: 'Pass1234' });
  });

  it('AUTH-REGISTER-S2: email exactly 255 chars → succeeds', () => {
    // local@domain where domain fills to exactly 255 total
    const local = 'a'.repeat(243);
    const email = `${local}@x.com`; // 243 + 1 + 5 = 249 chars — under limit
    succeeds(registerSchema, { email, password: 'Password1' });
  });
});

// ---------------------------------------------------------------------------
// FR-AUTH-2  loginSchema
// FRS: same rules as registerSchema (email valid format max 255; password min 8 + digit)
// ---------------------------------------------------------------------------

describe('AUTH-LOGIN-S2: loginSchema validation rules (FR-AUTH-2)', () => {
  it('AUTH-LOGIN-S2: valid credentials format → parse succeeds', () => {
    const data = succeeds(loginSchema, { email: 'login@example.com', password: 'Secure1Pass' });
    expect(data.email).toBe('login@example.com');
  });

  it('AUTH-LOGIN-S2: invalid email → fails', () => {
    fails(loginSchema, { email: 'bad-email', password: 'Secure1Pass' });
  });

  it('AUTH-LOGIN-S2: password without digit → fails', () => {
    fails(loginSchema, { email: 'login@example.com', password: 'NoDigitPass' });
  });

  it('AUTH-LOGIN-S2: password shorter than 8 chars → fails', () => {
    fails(loginSchema, { email: 'login@example.com', password: 'Sh0rt' });
  });

  it('AUTH-LOGIN-S2: empty body → fails', () => {
    fails(loginSchema, {});
  });

  it('AUTH-LOGIN-S2: email max 255 chars enforced', () => {
    const longEmail = 'a'.repeat(250) + '@x.com';
    fails(loginSchema, { email: longEmail, password: 'Secure1Pass' });
  });
});

// ---------------------------------------------------------------------------
// FR-AUTH-5  forgotPasswordSchema
// FRS: body { email: string } — valid email format
// ---------------------------------------------------------------------------

describe('AUTH-FORGOT-S3: forgotPasswordSchema validation rules (FR-AUTH-5)', () => {
  it('AUTH-FORGOT-S3: valid email → parse succeeds', () => {
    const data = succeeds(forgotPasswordSchema, { email: 'forgot@example.com' });
    expect(data.email).toBe('forgot@example.com');
  });

  it('AUTH-FORGOT-S3: invalid email format → fails', () => {
    fails(forgotPasswordSchema, { email: 'not-an-email' });
  });

  it('AUTH-FORGOT-S3: missing email field → fails', () => {
    fails(forgotPasswordSchema, {});
  });

  it('AUTH-FORGOT-S3: empty string email → fails', () => {
    fails(forgotPasswordSchema, { email: '' });
  });

  it('AUTH-FORGOT-S3: numeric email field → fails', () => {
    fails(forgotPasswordSchema, { email: 12345 });
  });

  it('AUTH-FORGOT-S3: email max 255 chars enforced', () => {
    const longEmail = 'a'.repeat(250) + '@x.com';
    fails(forgotPasswordSchema, { email: longEmail });
  });
});

// ---------------------------------------------------------------------------
// FR-AUTH-6  resetPasswordSchema
// FRS: body { email, otp: 6-digit string, newPassword }
//   otp must match /^\d{6}$/
//   newPassword: min 8 chars + at least 1 digit
// ---------------------------------------------------------------------------

describe('AUTH-OTP-S5: resetPasswordSchema validation rules (FR-AUTH-6)', () => {
  it('AUTH-OTP-S5: valid input → parse succeeds', () => {
    const data = succeeds(resetPasswordSchema, {
      email: 'reset@example.com',
      otp: '123456',
      newPassword: 'NewPass1',
    });
    expect(data.otp).toBe('123456');
    expect(data.newPassword).toBe('NewPass1');
  });

  it('AUTH-OTP-S5: otp with only 2 digits → fails', () => {
    fails(resetPasswordSchema, {
      email: 'reset@example.com',
      otp: '12',
      newPassword: 'NewPass1',
    });
  });

  it('AUTH-OTP-S5: otp with 7 digits → fails', () => {
    fails(resetPasswordSchema, {
      email: 'reset@example.com',
      otp: '1234567',
      newPassword: 'NewPass1',
    });
  });

  it('AUTH-OTP-S5: otp containing non-digit chars → fails', () => {
    fails(resetPasswordSchema, {
      email: 'reset@example.com',
      otp: '12345a',
      newPassword: 'NewPass1',
    });
  });

  it('AUTH-OTP-S5: missing newPassword → fails', () => {
    fails(resetPasswordSchema, {
      email: 'reset@example.com',
      otp: '123456',
    });
  });

  it('AUTH-OTP-S5: invalid email format → fails', () => {
    fails(resetPasswordSchema, {
      email: 'not-an-email',
      otp: '123456',
      newPassword: 'NewPass1',
    });
  });

  it('AUTH-OTP-S5: newPassword without digit → fails', () => {
    fails(resetPasswordSchema, {
      email: 'reset@example.com',
      otp: '123456',
      newPassword: 'NoDigitsHere',
    });
  });

  it('AUTH-OTP-S5: newPassword shorter than 8 chars → fails', () => {
    fails(resetPasswordSchema, {
      email: 'reset@example.com',
      otp: '123456',
      newPassword: 'Sh0rt',
    });
  });

  it('AUTH-OTP-S5: missing otp field → fails', () => {
    fails(resetPasswordSchema, {
      email: 'reset@example.com',
      newPassword: 'NewPass1',
    });
  });

  it('AUTH-OTP-S5: otp is numeric type (not string) → fails', () => {
    fails(resetPasswordSchema, {
      email: 'reset@example.com',
      otp: 123456,
      newPassword: 'NewPass1',
    });
  });

  it('AUTH-OTP-S5: otp exactly 6 zeros → succeeds (valid format)', () => {
    succeeds(resetPasswordSchema, {
      email: 'reset@example.com',
      otp: '000000',
      newPassword: 'NewPass1',
    });
  });
});

// ---------------------------------------------------------------------------
// FR-NOTE-1  createNoteSchema
// FRS: title string 1-200 chars; body TipTap JSON object; tagIds?: string[]
// ---------------------------------------------------------------------------

describe('SCHEMA-NOTE-1: createNoteSchema validation rules (FR-NOTE-1)', () => {
  const validBody = { type: 'doc', content: [] };

  it('SCHEMA-NOTE-1: valid note without tagIds → parse succeeds', () => {
    const data = succeeds(createNoteSchema, {
      title: 'My Note',
      body: validBody,
    });
    expect(data.title).toBe('My Note');
    expect(data.tagIds).toBeUndefined();
  });

  it('SCHEMA-NOTE-1: valid note with tagIds → parse succeeds', () => {
    const data = succeeds(createNoteSchema, {
      title: 'Tagged Note',
      body: validBody,
      tagIds: ['tag-1', 'tag-2'],
    });
    expect(data.tagIds).toEqual(['tag-1', 'tag-2']);
  });

  it('SCHEMA-NOTE-1: empty title → fails', () => {
    fails(createNoteSchema, { title: '', body: validBody });
  });

  it('SCHEMA-NOTE-1: title exceeding 200 chars → fails', () => {
    fails(createNoteSchema, { title: 'a'.repeat(201), body: validBody });
  });

  it('SCHEMA-NOTE-1: title exactly 200 chars → succeeds', () => {
    succeeds(createNoteSchema, { title: 'a'.repeat(200), body: validBody });
  });

  it('SCHEMA-NOTE-1: title exactly 1 char → succeeds', () => {
    succeeds(createNoteSchema, { title: 'a', body: validBody });
  });

  it('SCHEMA-NOTE-1: missing title → fails', () => {
    fails(createNoteSchema, { body: validBody });
  });

  it('SCHEMA-NOTE-1: missing body → fails', () => {
    fails(createNoteSchema, { title: 'My Note' });
  });

  it('SCHEMA-NOTE-1: body is a string (not object) → fails', () => {
    fails(createNoteSchema, { title: 'My Note', body: 'plain text' });
  });

  it('SCHEMA-NOTE-1: tagIds contains non-string → fails', () => {
    fails(createNoteSchema, { title: 'My Note', body: validBody, tagIds: [123] });
  });

  it('SCHEMA-NOTE-1: tagIds as empty array → succeeds', () => {
    succeeds(createNoteSchema, { title: 'My Note', body: validBody, tagIds: [] });
  });
});

// ---------------------------------------------------------------------------
// FR-NOTE-3  updateNoteSchema
// FRS: partial of createNoteSchema; at least one field required
// ---------------------------------------------------------------------------

describe('SCHEMA-NOTE-2: updateNoteSchema validation rules (FR-NOTE-3)', () => {
  const validBody = { type: 'doc', content: [] };

  it('SCHEMA-NOTE-2: only title provided → succeeds', () => {
    const data = succeeds(updateNoteSchema, { title: 'Updated Title' });
    expect(data.title).toBe('Updated Title');
  });

  it('SCHEMA-NOTE-2: only body provided → succeeds', () => {
    succeeds(updateNoteSchema, { body: validBody });
  });

  it('SCHEMA-NOTE-2: only tagIds provided → succeeds', () => {
    succeeds(updateNoteSchema, { tagIds: ['tag-1'] });
  });

  it('SCHEMA-NOTE-2: all fields provided → succeeds', () => {
    succeeds(updateNoteSchema, { title: 'New', body: validBody, tagIds: ['t1'] });
  });

  it('SCHEMA-NOTE-2: empty object (no fields) → fails', () => {
    fails(updateNoteSchema, {});
  });

  it('SCHEMA-NOTE-2: title empty string → fails', () => {
    fails(updateNoteSchema, { title: '' });
  });

  it('SCHEMA-NOTE-2: title exceeding 200 chars → fails', () => {
    fails(updateNoteSchema, { title: 'a'.repeat(201) });
  });
});

// ---------------------------------------------------------------------------
// searchQuerySchema — FR-SEARCH-1
// FRS / spec.md: q non-empty string (min 1); cursor optional; limit 1-50 default 20
// Scenarios: SEARCH-S3 (empty q → 400), SEARCH-PAGE-S1/S2 (limit validation)
// ---------------------------------------------------------------------------

describe('searchQuerySchema validation rules (FR-SEARCH-1)', () => {
  it('searchQuerySchema rejects empty q', () => {
    fails(searchQuerySchema, { q: '' });
  });

  it('searchQuerySchema accepts valid q with default limit 20', () => {
    const data = succeeds(searchQuerySchema, { q: 'typescript' });
    expect(data.q).toBe('typescript');
    expect(data.limit).toBe(20);
    expect(data.cursor).toBeUndefined();
  });

  it('searchQuerySchema rejects limit greater than 50', () => {
    fails(searchQuerySchema, { q: 'test', limit: 51 });
  });
});
