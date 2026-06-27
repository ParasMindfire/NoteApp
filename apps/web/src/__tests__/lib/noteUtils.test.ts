import { describe, it, expect } from 'vitest';
import { extractPlainText } from '@/lib/noteUtils';

describe('extractPlainText (spec decision 6 — AB-1011)', () => {
  it('UI-NOTES-LIST-S1: returns text from a simple paragraph node', () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    };
    expect(extractPlainText(json)).toBe('Hello world');
  });

  it('UI-NOTES-LIST-S1: returns text from a heading node', () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'My Heading' }],
        },
      ],
    };
    expect(extractPlainText(json)).toBe('My Heading');
  });

  it('UI-NOTES-LIST-S1: concatenates text from nested list > listItem > paragraph', () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Item one' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Item two' }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(extractPlainText(json)).toBe('Item oneItem two');
  });

  it('UI-NOTES-LIST-S1: empty doc with empty content array returns empty string', () => {
    const json = { type: 'doc', content: [] };
    expect(extractPlainText(json)).toBe('');
  });

  it('UI-NOTES-LIST-S1: null input returns empty string', () => {
    expect(extractPlainText(null)).toBe('');
  });

  it('UI-NOTES-LIST-S1: non-object primitive input returns empty string', () => {
    expect(extractPlainText('raw string')).toBe('');
    expect(extractPlainText(42)).toBe('');
    expect(extractPlainText(undefined)).toBe('');
  });

  it('UI-NOTES-LIST-S1: text longer than 100 chars is truncated at 100 characters', () => {
    const longText = 'a'.repeat(150);
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: longText }],
        },
      ],
    };
    const result = extractPlainText(json);
    expect(result).toHaveLength(100);
    expect(result).toBe('a'.repeat(100));
  });

  it('UI-NOTES-LIST-S1: multiple paragraphs are concatenated correctly', () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First. ' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second.' }],
        },
      ],
    };
    expect(extractPlainText(json)).toBe('First. Second.');
  });

  it('UI-NOTES-LIST-S1: respects custom maxLength parameter', () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world truncated' }],
        },
      ],
    };
    expect(extractPlainText(json, 5)).toBe('Hello');
  });
});
