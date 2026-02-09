<script>
  import {
    HomeIcon,
    ChatIcon,
    CalendarIcon,
    BellIcon,
    SettingsIcon,
    BookIcon
  } from '$lib/components/icons';
  import * as m from '$lib/paraglide/messages';

  let {
    selectedContentType = $bindable(),
    onContentTypeSelect,
    communitySelected = true
  } = $props();

  const contentTypes = [
    { id: 'home', label: m.community_layout_bottom_tab_bar_home(), icon: HomeIcon },
    { id: 'chat', label: m.community_layout_bottom_tab_bar_chat(), icon: ChatIcon },
    { id: 'calendar', label: m.community_layout_bottom_tab_bar_calendar(), icon: CalendarIcon },
    { id: 'learning', label: m.community_layout_bottom_tab_bar_learning(), icon: BookIcon },
    { id: 'activity', label: m.community_layout_bottom_tab_bar_activity(), icon: BellIcon },
    { id: 'settings', label: m.community_layout_bottom_tab_bar_settings(), icon: SettingsIcon }
  ];

  /**
   * Handle content type selection
   * @param {string} type
   */
  function handleContentTypeClick(type) {
    if (onContentTypeSelect) {
      onContentTypeSelect(type);
    }
  }
</script>

<!-- Desktop: Fixed right sidebar -->
<div
  class="fixed top-16 left-16 hidden h-[calc(100vh-8rem)] w-60 flex-col overflow-y-auto border-r border-base-300 bg-base-100 lg:flex"
>
  {#if !communitySelected}
    <div
      class="flex h-full flex-col items-center justify-center p-6 text-center text-base-content/60"
    >
      <p class="text-sm">{m.community_layout_content_nav_select_community()}</p>
    </div>
  {:else}
    <nav class="menu space-y-1 p-4">
      {#each contentTypes as type (type.id)}
        {@const isActive = selectedContentType === type.id}
        {@const Icon = type.icon}
        <button
          onclick={() => handleContentTypeClick(type.id)}
          class="flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200 {isActive
            ? 'bg-primary text-primary-content'
            : 'hover:bg-base-200'}"
        >
          <Icon class_="w-5 h-5" />
          <span class="text-sm font-medium">{type.label}</span>
        </button>
      {/each}
    </nav>
  {/if}
</div>
