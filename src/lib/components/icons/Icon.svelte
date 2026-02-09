<!--
  Base Icon Component
  Provides consistent styling and accessibility for all SVG icons
-->
<script>
  /**
   * @type {string} class - CSS classes to apply to the icon
   */
  export let class_ = 'w-5 h-5';

  /**
   * @type {string} title - Accessible title for the icon
   */
  export let title = '';

  /**
   * @type {string} stroke - Stroke color (defaults to currentColor)
   */
  export let stroke = 'currentColor';

  /**
   * @type {string} fill - Fill color (defaults to none)
   */
  export let fill = 'none';

  /**
   * @type {number} strokeWidth - Stroke width (defaults to 2)
   */
  export let strokeWidth = 2;

  /**
   * @type {string} viewBox - SVG viewBox (defaults to 24x24)
   */
  export let viewBox = '0 0 24 24';
</script>

<svg
  class={class_}
  {fill}
  {stroke}
  {viewBox}
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  role="img"
  aria-hidden={!title}
  aria-label={title}
>
  {#if title}
    <title>{title}</title>
  {/if}
  <slot />
</svg>
