<!--
  NostrContentRenderer - Renders parsed Nostr event content (NAST tree)
  Handles NIP-27 mentions, NIP-30 custom emojis, links, hashtags
-->

<script>
  import { parseEventContent } from '$lib/helpers/nostrContent.js';
  import NostrIdentifier from './NostrIdentifier.svelte';

  let { event, class: className = '' } = $props();

  let tree = $derived(event ? parseEventContent(event) : null);
</script>

<div class="{className} break-words whitespace-pre-wrap">
  {#if tree}
    {#each tree.children as node, i (i)}
      {#if node.type === 'text'}
        {node.value}
      {:else if node.type === 'emoji'}
        <img
          src={node.url}
          alt=":{node.code}:"
          title=":{node.code}:"
          class="inline h-5 w-5 align-text-bottom"
        />
      {:else if node.type === 'mention'}
        <NostrIdentifier identifier={node.encoded} inline={true} />
      {:else if node.type === 'link'}
        <a href={node.href} target="_blank" rel="noopener noreferrer" class="link link-primary"
          >{node.value}</a
        >
      {:else if node.type === 'hashtag'}
        <span class="text-primary">#{node.name}</span>
      {:else if node.type === 'gallery'}
        {#each node.links as link, j (j)}
          <a href={link} target="_blank" rel="noopener noreferrer" class="link link-primary"
            >{link}</a
          >
        {/each}
      {/if}
    {/each}
  {/if}
</div>
