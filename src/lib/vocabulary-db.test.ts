import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetchMock = vi.hoisted(() => vi.fn());

vi.mock('./auth', () => ({
  authFetch: authFetchMock,
}));

import { vocabularyBookOperations, wordOperations } from './vocabulary-db';

describe('vocabulary-db request helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses normal JSON success responses', async () => {
    authFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: vi.fn().mockResolvedValue(JSON.stringify({
        id: 'book-1',
        name: 'Book 1',
        description: 'test book',
        is_built_in: false,
        is_public: false,
        created_at: 1,
        updated_at: 1,
      })),
    });

    await expect(vocabularyBookOperations.getById('book-1')).resolves.toMatchObject({ id: 'book-1', name: 'Book 1' });
  });

  it('does not throw for successful empty-body responses', async () => {
    authFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: vi.fn().mockRejectedValue(new Error('Unexpected end of JSON input')),
      text: vi.fn().mockResolvedValue(''),
    });

    await expect(vocabularyBookOperations.delete('book-1')).resolves.toBeUndefined();
  });

  it('posts bulk word imports to the user vocabulary import endpoint', async () => {
    authFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: vi.fn().mockResolvedValue(JSON.stringify({ importedCount: 1 })),
    });

    await expect(wordOperations.bulkAdd('book-1', [{
      id: 'w1',
      bookId: 'book-1',
      word: 'abandon',
      translations: [{ type: '', translation: '放弃' }],
    }])).resolves.toBeUndefined();

    expect(authFetchMock).toHaveBeenCalledWith('/api/vocabulary/books/book-1/import', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ words: [{
        id: 'w1',
        bookId: 'book-1',
        word: 'abandon',
        translations: [{ type: '', translation: '放弃' }],
      }] }),
    }));
  });
});
