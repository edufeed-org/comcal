/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { preprocessNostrMentions } from '$lib/helpers/markdownNostr.js';

describe('preprocessNostrMentions', () => {
  it('converts bare nostr:npub1... to a markdown link', () => {
    const input = 'Hello nostr:npub1abcdefghij0123456789abcdefghij0123456789abcdefghijklm';
    const result = preprocessNostrMentions(input);
    expect(result).toContain(
      '[npub1abcde\u2026klm](/npub1abcdefghij0123456789abcdefghij0123456789abcdefghijklm)'
    );
    expect(result).toMatch(/^Hello /);
  });

  it('converts bare nostr:nprofile1... to a markdown link', () => {
    const input = 'See nostr:nprofile1abc123xyz789end';
    const result = preprocessNostrMentions(input);
    expect(result).toBe('See [nprofile1a\u2026end](/nprofile1abc123xyz789end)');
  });

  it('converts bare nostr:naddr1... to a markdown link', () => {
    const input = 'Check nostr:naddr1qqxyz789abcfinal';
    const result = preprocessNostrMentions(input);
    expect(result).toContain('[naddr1qqxy\u2026nal](/naddr1qqxyz789abcfinal)');
  });

  it('converts bare nostr:note1... to a markdown link', () => {
    const input = 'Replying to nostr:note1someidhere12345end';
    const result = preprocessNostrMentions(input);
    expect(result).toContain('[note1somei\u2026end](/note1someidhere12345end)');
  });

  it('converts bare nostr:nevent1... to a markdown link', () => {
    const input = 'See nostr:nevent1eventidabc123done';
    const result = preprocessNostrMentions(input);
    expect(result).toContain('[nevent1eve\u2026one](/nevent1eventidabc123done)');
  });

  it('leaves text without mentions unchanged', () => {
    const input = 'This is just plain text with no nostr mentions.';
    const result = preprocessNostrMentions(input);
    expect(result).toBe(input);
  });

  it('handles multiple mentions in one block', () => {
    const input =
      'By nostr:npub1aaaabbbbccccddddeeeeffffgggg1234 and nostr:npub1xxxxyyyy0000zzzzaaaabbbbcccc5678';
    const result = preprocessNostrMentions(input);
    // Both should be converted
    expect(result).toContain('/npub1aaaabbbbccccddddeeeeffffgggg1234)');
    expect(result).toContain('/npub1xxxxyyyy0000zzzzaaaabbbbcccc5678)');
    expect(result).toContain('By ');
    expect(result).toContain(' and ');
  });

  it('leaves [text](nostr:naddr1...) markdown links alone', () => {
    const input = 'Check [this article](nostr:naddr1qqxyz789abcfinal)';
    const result = preprocessNostrMentions(input);
    // The regex should NOT match inside a markdown link since it's preceded by (
    // The existing markdown link syntax is handled by the marked renderer override
    expect(result).toBe(input);
  });

  it('handles empty string', () => {
    expect(preprocessNostrMentions('')).toBe('');
  });

  it('handles mention at the very start of text', () => {
    const input = 'nostr:npub1startoftext0000endtext';
    const result = preprocessNostrMentions(input);
    expect(result).toBe('[npub1start\u2026ext](/npub1startoftext0000endtext)');
  });

  it('handles mention at the very end of text', () => {
    const input = 'Author: nostr:npub1endofline000finish';
    const result = preprocessNostrMentions(input);
    expect(result).toContain('/npub1endofline000finish)');
  });

  it('truncates display text correctly for short identifiers', () => {
    // Identifiers shorter than 14 chars (10 + 4) should still work
    const input = 'nostr:npub1short';
    const result = preprocessNostrMentions(input);
    expect(result).toContain('/npub1short)');
  });
});
