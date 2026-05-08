import type { Word, WordTranslation } from '../../types/vocabulary';

export interface VocabularyImportWarning {
  row: number;
  message: string;
}

export interface VocabularyTextParseResult {
  words: Word[];
  warnings: VocabularyImportWarning[];
}

const PHONETIC_PATTERN = /^[/\[].+[/\]]$/;
const WORD_CANDIDATE_PATTERN = /^[A-Za-z][A-Za-z\s'’\-/().]*$/;
const TYPE_TRANSLATION_PATTERN = /^(n|v|vt|vi|adj|adv|prep|conj|pron|num|art|int|phr|aux)\.?\s+(.+)$/i;
const LINE_DELIMITER_PATTERN = /^(.+?)\s*[-:：|\t]\s*(.+)$/;

function normalizePhonetic(value: string): string {
  return value.replace(/^\/+|\/+$/g, '').replace(/^\[|\]$/g, '').trim();
}

function createWord(bookId: string, index: number, word: string, translations: WordTranslation[], phonetic?: { us?: string; uk?: string }): Word {
  return {
    id: `${bookId}-import-${index}`,
    bookId,
    word,
    translations,
    ...(phonetic ? { phonetic } : {}),
  };
}

function normalizeLine(rawLine: string): string {
  return rawLine
    .replace(/^\uFEFF/, '')
    .replace(/^[•●▪◦·‣]+\s*/, '')
    .replace(/^\d+[.)、．]\s*/, '')
    .trim();
}

function parseLineMode(line: string, bookId: string, index: number): Word | null {
  const normalizedLine = normalizeLine(line);
  const match = normalizedLine.match(LINE_DELIMITER_PATTERN);
  if (!match) {
    return null;
  }

  const word = match[1].trim();
  const translation = match[2].trim();
  if (!word || !translation) {
    return null;
  }

  return createWord(bookId, index, word, [{ type: '', translation }]);
}

function parseBlockMode(block: string, bookId: string, index: number): Word | null {
  const lines = block
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  if (lines.length === 1) {
    return parseLineMode(lines[0], bookId, index);
  }

  const [firstLine, ...restLines] = lines;
  if (!WORD_CANDIDATE_PATTERN.test(firstLine)) {
    return parseLineMode(lines.join(' '), bookId, index);
  }

  const translations: WordTranslation[] = [];
  let phonetic: { us?: string; uk?: string } | undefined;

  for (const line of restLines) {
    if (PHONETIC_PATTERN.test(line)) {
      phonetic = { ...(phonetic || {}), us: normalizePhonetic(line) };
      continue;
    }

    const typeMatch = line.match(TYPE_TRANSLATION_PATTERN);
    if (typeMatch) {
      translations.push({
        type: typeMatch[1].toLowerCase(),
        translation: typeMatch[2].trim(),
      });
      continue;
    }

    translations.push({ type: '', translation: line });
  }

  const validTranslations = translations.filter(item => item.translation);
  if (validTranslations.length === 0) {
    return null;
  }

  return createWord(bookId, index, firstLine, validTranslations, phonetic);
}

export function parseVocabularyText(content: string, bookId: string): VocabularyTextParseResult {
  const blocks = content
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map(block => block.trim())
    .filter(Boolean);

  const words: Word[] = [];
  const warnings: VocabularyImportWarning[] = [];

  if (blocks.length === 0) {
    return { words, warnings };
  }

  blocks.forEach((block, blockIndex) => {
    const blockLines = block.split(/\r?\n/).map(normalizeLine).filter(Boolean);
    const lineWords = blockLines.map((line, lineIndex) => parseLineMode(line, bookId, blockIndex * 1000 + lineIndex));

    if (blockLines.length > 1 && lineWords.every(Boolean)) {
      words.push(...lineWords.filter((item): item is Word => item !== null));
      return;
    }

    const parsedWord = parseBlockMode(block, bookId, blockIndex);
    if (parsedWord) {
      words.push(parsedWord);
      return;
    }

    blockLines.forEach((line, lineIndex) => {
      const lineWord = parseLineMode(line, bookId, blockIndex * 1000 + lineIndex);
      if (lineWord) {
        words.push(lineWord);
      } else {
        warnings.push({
          row: blockIndex + 1,
          message: `无法解析文本块：${line.slice(0, 50)}`,
        });
      }
    });
  });

  return { words, warnings };
}
