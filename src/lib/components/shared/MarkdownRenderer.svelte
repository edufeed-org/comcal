<!--
  MarkdownRenderer Component
  Safely renders markdown content with XSS protection.
  Converts bare nostr: mentions to app links and renders nostr: protocol hrefs.
-->

<script>
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import { browser } from '$app/environment';
  import { preprocessNostrMentions } from '$lib/helpers/markdownNostr.js';

  let { content = '', class: className = 'prose prose-lg max-w-none' } = $props();

  // Configure marked options and custom renderer
  /** @type {import('marked').RendererObject} */
  const renderer = {
    link({ href, title, tokens }) {
      // Rewrite nostr: protocol links to app routes
      if (href?.startsWith('nostr:')) {
        href = '/' + href.slice(6);
      }
      /** @type {string} */
      const text = tokens ? /** @type {any} */ (this).parser.parseInline(tokens) : '';
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${href}"${titleAttr}>${text}</a>`;
    }
  };

  marked.use({
    breaks: true,
    gfm: true,
    renderer
  });

  // Parse and sanitize markdown content
  let html = $derived.by(() => {
    if (!content || typeof content !== 'string') {
      return '';
    }

    try {
      // Pre-process bare nostr: mentions into markdown links, then parse
      const rawHtml = marked.parse(preprocessNostrMentions(content), { async: false });

      // Only sanitize in browser context (DOMPurify requires DOM)
      if (browser && typeof DOMPurify?.sanitize === 'function') {
        return DOMPurify.sanitize(String(rawHtml), {
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
      return String(rawHtml);
    } catch (error) {
      console.error('Markdown parsing error:', error);
      return content.replace(/\n/g, '<br>');
    }
  });
</script>

<div class={className}>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- safe: sanitized with DOMPurify -->
  {@html html}
</div>
