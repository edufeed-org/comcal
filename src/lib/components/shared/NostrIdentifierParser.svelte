<!--
  NostrIdentifierParser Component
  Parses text and renders NIP-19 identifiers inline
  Similar to LocationLink.svelte pattern
-->

<script>
  import { extractNostrIdentifiers } from '$lib/helpers/nostrUtils.js';
  import NostrIdentifier from './NostrIdentifier.svelte';

  let { text = '' } = $props();

  let identifierMatches = $derived(extractNostrIdentifiers(text));
  let hasIdentifiers = $derived(identifierMatches.length > 0);

  /**
   * Parse text into segments of plain text and identifiers
   */
  function renderSegments() {
    if (!hasIdentifiers) {
      return [{ type: 'text', content: text }];
    }

    const segments = [];
    let lastIndex = 0;

    for (const match of identifierMatches) {
      // Add text before identifier
      if (match.start > lastIndex) {
        segments.push({
          type: 'text',
          content: text.substring(lastIndex, match.start)
        });
      }

      // Add identifier
      segments.push({
        type: 'identifier',
        content: match.identifier
      });

      lastIndex = match.end;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      segments.push({
        type: 'text',
        content: text.substring(lastIndex)
      });
    }

    return segments;
  }

  let segments = $derived(renderSegments());
</script>

<span class="nostr-identifier-parser">
  {#each segments as segment, i (i)}
    {#if segment.type === 'identifier'}
      <NostrIdentifier identifier={segment.content} inline={true} />
    {:else}
      {segment.content}
    {/if}
  {/each}
</span>
