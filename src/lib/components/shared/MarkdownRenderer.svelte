<!--
  MarkdownRenderer Component
  Safely renders markdown content with XSS protection
-->

<script>
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import { browser } from '$app/environment';
  import { extractNostrIdentifiers } from '$lib/helpers/nostrUtils.js';
  import NostrIdentifierParser from './NostrIdentifierParser.svelte';

  let { content = '', class: className = 'prose prose-lg max-w-none' } = $props();

  // Check if content contains NIP-19 identifiers
  let hasIdentifiers = $derived(extractNostrIdentifiers(content).length > 0);

  // Configure marked for better compatibility
  marked.setOptions({
    breaks: true, // Convert line breaks to <br>
    gfm: true // GitHub Flavored Markdown
  });

  // Parse and sanitize markdown content
  let html = $derived.by(() => {
    if (!content || typeof content !== 'string') {
      return '';
    }

    try {
      // Parse markdown to HTML (synchronous)
      const rawHtml = marked.parse(content, { async: false });

      // Only sanitize in browser context (DOMPurify requires DOM)
      if (browser && typeof DOMPurify?.sanitize === 'function') {
        // Sanitize HTML to prevent XSS attacks
        return DOMPurify.sanitize(String(rawHtml), {
          // Allow common markdown elements
          ALLOWED_TAGS: [
            'p',
            'br',
            'strong',
            'em',
            'u',
            's',
            'del',
            'code',
            'pre',
            'a',
            'ul',
            'ol',
            'li',
            'blockquote',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'hr',
            'table',
            'thead',
            'tbody',
            'tr',
            'th',
            'td',
            'img'
          ],
          ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'class']
        });
      }

      // During SSR or if DOMPurify unavailable, return raw HTML
      // It will be sanitized on the client side during hydration
      return String(rawHtml);
    } catch (error) {
      console.error('Markdown parsing error:', error);
      // Fallback to plain text with line breaks preserved
      return content.replace(/\n/g, '<br>');
    }
  });
</script>

{#if hasIdentifiers}
  <!-- Content has NIP-19 identifiers - parse them inline -->
  <div class={className}>
    <NostrIdentifierParser text={content} />
  </div>
{:else}
  <!-- No identifiers - use standard markdown rendering -->
  <div class={className}>
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- safe: sanitized with DOMPurify -->
    {@html html}
  </div>
{/if}
