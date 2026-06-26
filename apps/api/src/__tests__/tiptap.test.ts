/**
 * Unit tests for apps/api/src/lib/tiptap.ts — extractText()
 *
 * Coverage:
 *   T8a (tasks.md) → FR-SEARCH-1
 *   Validates that bodyText extraction from TipTap JSON is correct for
 *   all structural cases described in the AB-1007 spec.
 */

import { describe, it, expect } from 'vitest';
import { extractText } from '../lib/tiptap.js';

describe('extractText (lib/tiptap.ts)', () => {
  it('returns text from a simple paragraph', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    };
    expect(extractText(doc)).toBe('Hello world');
  });

  it('returns text from nested heading and paragraph nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'My Heading' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Some paragraph text' }],
        },
      ],
    };
    const result = extractText(doc);
    expect(result).toContain('My Heading');
    expect(result).toContain('Some paragraph text');
  });

  it('returns empty string for empty doc', () => {
    const doc = { type: 'doc', content: [] };
    expect(extractText(doc)).toBe('');
  });

  it('returns empty string for null or non-object input', () => {
    expect(extractText(null)).toBe('');
    expect(extractText(undefined)).toBe('');
    expect(extractText(42)).toBe('');
    expect(extractText('string')).toBe('');
  });

  it('joins multiple sibling text nodes with spaces', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First paragraph' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second paragraph' }],
        },
      ],
    };
    const result = extractText(doc);
    expect(result).toBe('First paragraph Second paragraph');
  });
});
