<script>
  import {
    HomeIcon,
    ChatIcon,
    CalendarIcon,
    BellIcon,
    SettingsIcon,
    BookIcon
  } from '$lib/components/icons';
  import {
    getCommunityAvailableContentTypes,
    kindToContentType
  } from '$lib/helpers/contentTypes.js';
  import { onMount } from 'svelte';
  import * as m from '$lib/paraglide/messages';

  let {
    selectedContentType = $bindable(),
    onContentTypeSelect,
    communityEvent = null // The community's kind:10222 event
  } = $props();

  // Icon mapping for content types
  /** @type {Record<string, any>} */
  const iconMap = {
    home: HomeIcon,
    chat: ChatIcon,
    calendar: CalendarIcon,
    learning: BookIcon,
    activity: BellIcon,
    settings: SettingsIcon
  };

  // State for scroll indicators
  let scrollContainer = $state(/** @type {HTMLElement|null} */ (null));
  let showLeftScroll = $state(false);
  let showRightScroll = $state(false);

  /**
   * Get content types to display in dock
   * @typedef {Object} DockContentType
   * @property {string} id
   * @property {string} label
   * @property {any} icon
   * @property {number} [kind]
   * @returns {Array<DockContentType>}
   */
  function getContentTypes() {
    /** @type {Array<DockContentType>} */
    const types = [{ id: 'home', label: m.community_layout_bottom_tab_bar_home(), icon: HomeIcon }];

    // If we have a community event, get its content types
    if (communityEvent) {
      const availableTypes = getCommunityAvailableContentTypes(communityEvent);

      // Map available content types to dock items
      for (const contentType of availableTypes) {
        const typeId = kindToContentType(contentType.kind);
        if (typeId && contentType.enabled && typeId !== 'home') {
          // Get icon and label
          const icon = iconMap[typeId] || ChatIcon;
          const label = contentType.name;

          types.push({
            id: typeId,
            label,
            icon,
            kind: contentType.kind
          });
        }
      }
    } else {
      // Default content types when no community
      types.push(
        { id: 'chat', label: m.community_layout_bottom_tab_bar_chat(), icon: ChatIcon },
        { id: 'calendar', label: m.community_layout_bottom_tab_bar_calendar(), icon: CalendarIcon },
        { id: 'learning', label: m.community_layout_bottom_tab_bar_learning(), icon: BookIcon }
      );
    }

    // Add common types at the end
    types.push(
      { id: 'activity', label: m.community_layout_bottom_tab_bar_activity(), icon: BellIcon },
      { id: 'settings', label: m.community_layout_bottom_tab_bar_settings(), icon: SettingsIcon }
    );

    return types;
  }

  const contentTypes = $derived(getContentTypes());

  /**
   * Handle content type selection
   * @param {string} type
   */
  function handleDockClick(type) {
    if (onContentTypeSelect) {
      onContentTypeSelect(type);
    }
  }

  /**
   * Check scroll position and update indicators
   */
  function updateScrollIndicators() {
    if (!scrollContainer) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
    showLeftScroll = scrollLeft > 10;
    showRightScroll = scrollLeft < scrollWidth - clientWidth - 10;
  }

  /**
   * Scroll the dock left or right
   * @param {'left'|'right'} direction
   */
  function scrollDock(direction) {
    if (!scrollContainer) return;

    const scrollAmount = 200;
    const newScrollLeft =
      direction === 'left'
        ? scrollContainer.scrollLeft - scrollAmount
        : scrollContainer.scrollLeft + scrollAmount;

    scrollContainer.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  }

  onMount(() => {
    if (scrollContainer) {
      updateScrollIndicators();
      scrollContainer.addEventListener('scroll', updateScrollIndicators);
      window.addEventListener('resize', updateScrollIndicators);

      return () => {
        scrollContainer?.removeEventListener('scroll', updateScrollIndicators);
        window.removeEventListener('resize', updateScrollIndicators);
      };
    }
  });
</script>

<!-- Mobile/Tablet: Dock Navigation -->
<div
  class="pb-safe fixed right-0 bottom-0 left-0 z-50 border-t border-base-300 bg-base-100 lg:hidden"
>
  <div class="relative">
    <!-- Left scroll indicator -->
    {#if showLeftScroll}
      <button
        onclick={() => scrollDock('left')}
        class="absolute top-0 bottom-0 left-0 z-10 flex w-12 items-center justify-start bg-gradient-to-r from-base-100 to-transparent pl-2"
        aria-label={m.community_layout_bottom_tab_bar_scroll_left()}
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>
    {/if}

    <!-- Right scroll indicator -->
    {#if showRightScroll}
      <button
        onclick={() => scrollDock('right')}
        class="absolute top-0 right-0 bottom-0 z-10 flex w-12 items-center justify-end bg-gradient-to-l from-base-100 to-transparent pr-2"
        aria-label={m.community_layout_bottom_tab_bar_scroll_right()}
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    {/if}

    <!-- Dock container with horizontal scroll -->
    <div
      bind:this={scrollContainer}
      class="scrollbar-hide snap-x snap-mandatory overflow-x-auto"
      style="scroll-behavior: smooth;"
    >
      <!-- DaisyUI Dock Component -->
      <div class="dock dock-lg mx-auto min-w-max px-4 py-2">
        {#each contentTypes as type (type.id)}
          {@const isActive = selectedContentType === type.id}
          {@const Icon = type.icon}
          <button
            class:dock-active={isActive}
            onclick={() => handleDockClick(type.id)}
            class="snap-center"
          >
            <Icon class_="size-[1.2em]" />
            <span class="dock-label text-xs">{type.label}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  /* Hide scrollbar but keep functionality */
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  /* Safe area for devices with notches/home indicators */
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom);
  }
</style>
