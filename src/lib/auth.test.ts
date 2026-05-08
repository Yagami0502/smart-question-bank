import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_LOGOUT_EVENT, authFetch, changePassword, logout } from './auth';

function createJsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('authFetch', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('mindforge_access_token', 'expired-access-token');
    localStorage.setItem('mindforge_refresh_token', 'refresh-token');
    localStorage.setItem('mindforge_user', JSON.stringify({ id: 'u1' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('clears auth and emits a logout event when logout succeeds', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(createJsonResponse({ ok: true }, { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);
    const logoutListener = vi.fn();
    window.addEventListener(AUTH_LOGOUT_EVENT, logoutListener);

    await logout();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('mindforge_access_token')).toBeNull();
    expect(localStorage.getItem('mindforge_refresh_token')).toBeNull();
    expect(logoutListener).toHaveBeenCalledTimes(1);

    window.removeEventListener(AUTH_LOGOUT_EVENT, logoutListener);
  });

  it('clears auth and emits a logout event after password change succeeds', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(createJsonResponse({ ok: true }, { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);
    const logoutListener = vi.fn();
    window.addEventListener(AUTH_LOGOUT_EVENT, logoutListener);

    await changePassword('old-password', 'new-password');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('mindforge_access_token')).toBeNull();
    expect(localStorage.getItem('mindforge_refresh_token')).toBeNull();
    expect(logoutListener).toHaveBeenCalledTimes(1);

    window.removeEventListener(AUTH_LOGOUT_EVENT, logoutListener);
  });

  it('refreshes expired tokens and retries once', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(createJsonResponse({ code: 'TOKEN_EXPIRED' }, { status: 401 }))
      .mockResolvedValueOnce(createJsonResponse({ accessToken: 'fresh-access-token' }, { status: 200 }))
      .mockResolvedValueOnce(createJsonResponse({ ok: true }, { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);
    const logoutListener = vi.fn();
    window.addEventListener(AUTH_LOGOUT_EVENT, logoutListener);

    const response = await authFetch('/api/protected');

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.any(Headers),
    });
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get('Authorization')).toBe('Bearer expired-access-token');
    expect((fetchMock.mock.calls[2]?.[1]?.headers as Headers).get('Authorization')).toBe('Bearer fresh-access-token');
    expect(localStorage.getItem('mindforge_access_token')).toBe('fresh-access-token');
    expect(logoutListener).not.toHaveBeenCalled();

    window.removeEventListener(AUTH_LOGOUT_EVENT, logoutListener);
  });

  it('clears auth and emits a logout event when refresh fails', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(createJsonResponse({ code: 'TOKEN_EXPIRED' }, { status: 401 }))
      .mockResolvedValueOnce(createJsonResponse({ error: 'refresh failed' }, { status: 401 }));

    vi.stubGlobal('fetch', fetchMock);
    const logoutListener = vi.fn();
    window.addEventListener(AUTH_LOGOUT_EVENT, logoutListener);

    const response = await authFetch('/api/protected');

    expect(response.status).toBe(401);
    expect(localStorage.getItem('mindforge_access_token')).toBeNull();
    expect(localStorage.getItem('mindforge_refresh_token')).toBeNull();
    expect(logoutListener).toHaveBeenCalledTimes(1);

    window.removeEventListener(AUTH_LOGOUT_EVENT, logoutListener);
  });

  it.each([
    [{ error: 'still unauthorized' }, 401],
    [{ error: '无效的令牌' }, 403],
  ])('clears auth and emits a logout event when the retried request remains unauthorized', async (body, status) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(createJsonResponse({ code: 'TOKEN_EXPIRED' }, { status: 401 }))
      .mockResolvedValueOnce(createJsonResponse({ accessToken: 'fresh-access-token' }, { status: 200 }))
      .mockResolvedValueOnce(createJsonResponse(body, { status }));

    vi.stubGlobal('fetch', fetchMock);
    const logoutListener = vi.fn();
    window.addEventListener(AUTH_LOGOUT_EVENT, logoutListener);

    const response = await authFetch('/api/protected');

    expect(response.status).toBe(status);
    expect(localStorage.getItem('mindforge_access_token')).toBeNull();
    expect(localStorage.getItem('mindforge_refresh_token')).toBeNull();
    expect(logoutListener).toHaveBeenCalledTimes(1);

    window.removeEventListener(AUTH_LOGOUT_EVENT, logoutListener);
  });

  it('clears auth and emits a logout event for invalid tokens', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(createJsonResponse({ error: '无效的令牌' }, { status: 403 }));

    vi.stubGlobal('fetch', fetchMock);
    const logoutListener = vi.fn();
    window.addEventListener(AUTH_LOGOUT_EVENT, logoutListener);

    const response = await authFetch('/api/protected');

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('mindforge_access_token')).toBeNull();
    expect(localStorage.getItem('mindforge_refresh_token')).toBeNull();
    expect(logoutListener).toHaveBeenCalledTimes(1);

    window.removeEventListener(AUTH_LOGOUT_EVENT, logoutListener);
  });
});
