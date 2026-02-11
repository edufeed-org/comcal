<script>
  import { PlusIcon, CalendarIcon } from '$lib/components/icons';
  import { modalStore } from '$lib/stores/modal.svelte.js';

  // Props
  let { communityPubkey = '' } = $props();

  /**
   * Handle creating a new event
   */
  function handleCreateEvent() {
    modalStore.openModal('calendarEvent', {
      communityPubkey,
      selectedDate: new Date(),
      mode: 'create'
    });
  }

  /**
   * Handle creating a new calendar
   */
  function handleCreateCalendar() {
    modalStore.openModal('createCalendar');
  }
</script>

<!-- Floating Action Button Container -->
<div class="fab fixed right-6 bottom-20 z-[60] lg:bottom-6">
  <!-- Main FAB Button -->
  <div
    tabindex="0"
    role="button"
    class="btn btn-circle shadow-lg btn-lg btn-primary hover:shadow-xl"
    aria-label="Open actions menu"
  >
    <PlusIcon class_="h-6 w-6" />
  </div>

  <!-- Action buttons that show up when FAB is open -->
  <button
    class="tooltip btn tooltip-left btn-circle btn-lg"
    data-tip="Create Event"
    onclick={handleCreateEvent}
    aria-label="Create new event"
  >
    <CalendarIcon class_="h-5 w-5" />
  </button>

  <!-- Only show Create Calendar option for personal calendars -->
  {#if !communityPubkey}
    <button
      class="tooltip btn tooltip-left btn-circle btn-lg"
      data-tip="Create Calendar"
      onclick={handleCreateCalendar}
      aria-label="Create new calendar"
    >
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
        />
      </svg>
    </button>
  {/if}
</div>

<!-- Both CalendarEventModal and CalendarCreationModal are now rendered by ModalManager -->
