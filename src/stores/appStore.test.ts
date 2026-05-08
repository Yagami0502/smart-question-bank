import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetchMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/auth', () => ({
  isLoggedIn: vi.fn(() => true),
  authFetch: authFetchMock,
}));

import { useAppStore } from './appStore';

const DEFAULT_SETTINGS = {
  dailyNewCards: 20,
  dailyReviews: 100,
  showTimer: true,
  autoPlayAudio: false,
  errorWeightMultiplier: 2.0,
  decayWeightMultiplier: 1.0,
};

describe('useAppStore user settings sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAppStore.setState({
      currentDeckId: null,
      session: null,
      isLoading: false,
      error: null,
      settings: { ...DEFAULT_SETTINGS },
    });
  });

  it('merges loaded server settings with existing defaults', async () => {
    authFetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        dailyNewCards: 42,
      }),
    });

    await useAppStore.getState().loadUserSettings();

    expect(useAppStore.getState().settings).toEqual({
      dailyNewCards: 42,
      dailyReviews: 100,
      showTimer: true,
      autoPlayAudio: false,
      errorWeightMultiplier: 2.0,
      decayWeightMultiplier: 1.0,
    });
  });

  it('ignores server settings with invalid field types', async () => {
    authFetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        dailyNewCards: '42',
        dailyReviews: null,
        showTimer: 'true',
        autoPlayAudio: 1,
        errorWeightMultiplier: '2.5',
        decayWeightMultiplier: {},
      }),
    });

    await useAppStore.getState().loadUserSettings();

    expect(useAppStore.getState().settings).toEqual({
      dailyNewCards: 20,
      dailyReviews: 100,
      showTimer: true,
      autoPlayAudio: false,
      errorWeightMultiplier: 2.0,
      decayWeightMultiplier: 1.0,
    });
  });

  it('ignores server settings with invalid numeric values', async () => {
    authFetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        dailyNewCards: -1,
        dailyReviews: 0,
        errorWeightMultiplier: Number.NaN,
        decayWeightMultiplier: Number.POSITIVE_INFINITY,
      }),
    });

    await useAppStore.getState().loadUserSettings();

    expect(useAppStore.getState().settings).toEqual({
      dailyNewCards: 20,
      dailyReviews: 100,
      showTimer: true,
      autoPlayAudio: false,
      errorWeightMultiplier: 2.0,
      decayWeightMultiplier: 1.0,
    });
  });

  it('ignores non-object server settings payloads', async () => {
    authFetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(null),
    });

    await useAppStore.getState().loadUserSettings();

    expect(useAppStore.getState().settings).toEqual({
      dailyNewCards: 20,
      dailyReviews: 100,
      showTimer: true,
      autoPlayAudio: false,
      errorWeightMultiplier: 2.0,
      decayWeightMultiplier: 1.0,
    });
  });

  it('ignores out-of-range multiplier values', async () => {
    authFetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        errorWeightMultiplier: -100,
        decayWeightMultiplier: 9999,
      }),
    });

    await useAppStore.getState().loadUserSettings();

    expect(useAppStore.getState().settings).toEqual({
      dailyNewCards: 20,
      dailyReviews: 100,
      showTimer: true,
      autoPlayAudio: false,
      errorWeightMultiplier: 2.0,
      decayWeightMultiplier: 1.0,
    });
  });

  it('ignores array server settings payloads', async () => {
    authFetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
    });

    await useAppStore.getState().loadUserSettings();

    expect(useAppStore.getState().settings).toEqual({
      dailyNewCards: 20,
      dailyReviews: 100,
      showTimer: true,
      autoPlayAudio: false,
      errorWeightMultiplier: 2.0,
      decayWeightMultiplier: 1.0,
    });
  });

  it('logs an error when saving user settings fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    authFetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: 'save failed' }),
    });

    await useAppStore.getState().saveUserSettings();

    expect(authFetchMock).toHaveBeenCalledWith('/api/user-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dailyNewCards: 20,
        dailyReviews: 100,
        showTimer: true,
        autoPlayAudio: false,
        errorWeightMultiplier: 2.0,
        decayWeightMultiplier: 1.0,
      }),
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
