import { describe, expect, it } from 'vitest';
import { parseVocabularyText } from './vocabulary-text-parser';

describe('parseVocabularyText', () => {
  it('parses delimiter-based vocabulary lines', () => {
    const result = parseVocabularyText('abandon - 放弃\nability: 能力', 'book-1');

    expect(result.words).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);
    expect(result.words[0]).toMatchObject({
      bookId: 'book-1',
      word: 'abandon',
      translations: [{ type: '', translation: '放弃' }],
    });
    expect(result.words[1]).toMatchObject({
      word: 'ability',
      translations: [{ type: '', translation: '能力' }],
    });
  });

  it('parses block-based entries extracted from Word-like text', () => {
    const result = parseVocabularyText('abandon\n/əˈbændən/\nv. 放弃', 'book-2');

    expect(result.words).toHaveLength(1);
    expect(result.words[0]).toMatchObject({
      word: 'abandon',
      phonetic: { us: 'əˈbændən' },
      translations: [{ type: 'v', translation: '放弃' }],
    });
  });

  it('returns warnings for unparseable text blocks', () => {
    const result = parseVocabularyText('这是一段无法识别的说明文字', 'book-3');

    expect(result.words).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toContain('无法解析文本块');
  });
});
