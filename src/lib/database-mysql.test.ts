import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetchMock = vi.hoisted(() => vi.fn());

vi.mock('./auth', () => ({
  authFetch: authFetchMock,
}));

import { deckOperations } from './database-mysql';

describe('database-mysql request helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses normal JSON success responses', async () => {
    authFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: vi.fn().mockResolvedValue(JSON.stringify({
        id: 'deck-1',
        name: 'Deck 1',
        description: 'test deck',
        settings: {
          newCardsPerDay: 20,
          reviewsPerDay: 100,
          maxInterval: 365,
          learningSteps: [1, 10],
          graduatingInterval: 1,
          easyInterval: 4,
        },
        createdAt: 1,
        updatedAt: 1,
      })),
    });

    await expect(deckOperations.getById('deck-1')).resolves.toMatchObject({ id: 'deck-1', name: 'Deck 1' });
  });

  it('does not throw for successful 204 delete responses', async () => {
    authFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: new Headers(),
      json: vi.fn().mockRejectedValue(new Error('Unexpected end of JSON input')),
      text: vi.fn().mockResolvedValue(''),
    });

    await expect(deckOperations.delete('deck-1')).resolves.toBeUndefined();
  });
});
