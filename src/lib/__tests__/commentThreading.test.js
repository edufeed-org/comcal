/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  getPlainTextExcerpt,
  getParentChain,
  getSubtree,
  buildCommentTree
} from '$lib/helpers/commentThreading.js';

// Helper to build a minimal comment tree for testing
function makeTree() {
  const comments = [
    {
      id: 'a',
      created_at: 100,
      tags: [
        ['k', '11'],
        ['e', 'root']
      ],
      content: 'top-level A'
    },
    {
      id: 'b',
      created_at: 200,
      tags: [
        ['k', '11'],
        ['e', 'root']
      ],
      content: 'top-level B'
    },
    {
      id: 'c',
      created_at: 150,
      tags: [
        ['k', '1111'],
        ['e', 'a']
      ],
      content: 'reply to A'
    },
    {
      id: 'd',
      created_at: 160,
      tags: [
        ['k', '1111'],
        ['e', 'c']
      ],
      content: 'reply to C (deep)'
    },
    {
      id: 'e',
      created_at: 170,
      tags: [
        ['k', '1111'],
        ['e', 'd']
      ],
      content: 'reply to D (deeper)'
    }
  ];
  return buildCommentTree(comments);
}

describe('getPlainTextExcerpt', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(getPlainTextExcerpt(null)).toBe('');
    expect(getPlainTextExcerpt(undefined)).toBe('');
    expect(getPlainTextExcerpt('')).toBe('');
  });

  it('returns text unchanged when under limit', () => {
    expect(getPlainTextExcerpt('Hello world')).toBe('Hello world');
  });

  it('strips markdown formatting characters', () => {
    expect(getPlainTextExcerpt('**bold** and *italic*')).toBe('bold and italic');
    expect(getPlainTextExcerpt('# Heading')).toBe('Heading');
    expect(getPlainTextExcerpt('`code` block')).toBe('code block');
    expect(getPlainTextExcerpt('[link](url)')).toBe('link(url)');
    expect(getPlainTextExcerpt('> blockquote')).toBe('blockquote');
    expect(getPlainTextExcerpt('~~strikethrough~~')).toBe('strikethrough');
  });

  it('collapses multiple newlines into spaces', () => {
    expect(getPlainTextExcerpt('line one\n\nline two\nline three')).toBe(
      'line one line two line three'
    );
  });

  it('truncates text exceeding maxLength with ellipsis', () => {
    const long = 'a'.repeat(150);
    const result = getPlainTextExcerpt(long, 100);
    expect(result.length).toBe(101); // 100 chars + ellipsis
    expect(result.endsWith('…')).toBe(true);
  });

  it('respects custom maxLength', () => {
    const text = 'Hello world, this is a test string';
    const result = getPlainTextExcerpt(text, 10);
    expect(result).toBe('Hello worl…');
  });

  it('does not truncate text exactly at maxLength', () => {
    const text = 'a'.repeat(100);
    expect(getPlainTextExcerpt(text, 100)).toBe(text);
  });

  it('trims whitespace', () => {
    expect(getPlainTextExcerpt('  spaced  ')).toBe('spaced');
  });
});

describe('getParentChain', () => {
  it('returns path from root to target (inclusive)', () => {
    const tree = makeTree();
    // Comment 'e' is nested: b(top) or a(top) -> c -> d -> e
    const chain = getParentChain(tree, 'e');
    const ids = chain.map((n) => n.id);
    expect(ids).toEqual(['a', 'c', 'd', 'e']);
  });

  it('returns single-element array for top-level comment', () => {
    const tree = makeTree();
    const chain = getParentChain(tree, 'b');
    expect(chain.map((n) => n.id)).toEqual(['b']);
  });

  it('returns empty array for non-existent ID', () => {
    const tree = makeTree();
    expect(getParentChain(tree, 'nonexistent')).toEqual([]);
  });

  it('returns empty array for empty tree', () => {
    expect(getParentChain([], 'a')).toEqual([]);
  });
});

describe('getSubtree', () => {
  it('returns the node with its replies', () => {
    const tree = makeTree();
    const subtree = getSubtree(tree, 'c');
    expect(subtree).not.toBeNull();
    expect(subtree.id).toBe('c');
    expect(subtree.replies.length).toBe(1);
    expect(subtree.replies[0].id).toBe('d');
  });

  it('returns null for non-existent ID', () => {
    const tree = makeTree();
    expect(getSubtree(tree, 'nonexistent')).toBeNull();
  });

  it('returns top-level node', () => {
    const tree = makeTree();
    const subtree = getSubtree(tree, 'a');
    expect(subtree).not.toBeNull();
    expect(subtree.id).toBe('a');
  });

  it('returns null for empty tree', () => {
    expect(getSubtree([], 'a')).toBeNull();
  });
});
