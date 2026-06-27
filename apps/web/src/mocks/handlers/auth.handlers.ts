import { http, HttpResponse } from 'msw';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const authHandlers = [
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.email === 'user@example.com' && body.password === 'Password1') {
      return HttpResponse.json({
        accessToken: 'mock-access-token',
        user: { id: 'user-1', email: body.email },
      });
    }
    return HttpResponse.json({ code: 'AUTH_INVALID_CREDENTIALS' }, { status: 401 });
  }),

  http.post(`${BASE}/auth/register`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.email === 'existing@example.com') {
      return HttpResponse.json({ code: 'USER_EXISTS' }, { status: 409 });
    }
    return new HttpResponse(null, { status: 201 });
  }),

  http.post(`${BASE}/auth/logout`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/auth/refresh`, () => {
    return HttpResponse.json({ accessToken: 'refreshed-access-token' });
  }),

  http.post(`${BASE}/auth/forgot-password`, async ({ request }) => {
    const body = (await request.json()) as { email: string };
    if (body.email === 'ratelimited@example.com') {
      return HttpResponse.json({ code: 'RATE_LIMITED' }, { status: 429 });
    }
    return HttpResponse.json({ message: "If your account exists, you'll receive an OTP" });
  }),

  http.post(`${BASE}/auth/reset-password`, async ({ request }) => {
    const body = (await request.json()) as { otp: string };
    if (body.otp === '000000') {
      return HttpResponse.json({ code: 'AUTH_OTP_INVALID' }, { status: 401 });
    }
    return new HttpResponse(null, { status: 204 });
  }),
];
