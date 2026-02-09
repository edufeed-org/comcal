<script>
  import { PlusIcon, CalendarIcon } from '$lib/components/icons';
  import CalendarEventModal from './CalendarEventModal.svelte';
  import CalendarCreationModal from './CalendarCreationModal.svelte';

  // Props
  let { communityPubkey = '' } = $props();

  // Event modal state
  let isEventModalOpen = $state(false);
  let selectedDateForNewEvent = $state(/** @type {Date | null} */ (null));

  // Calendar modal state
  let isCalendarModalOpen = $state(false);

  /**
   * Handle creating a new event
   */
  function handleCreateEvent() {
    selectedDateForNewEvent = new Date();
    isEventModalOpen = true;
  }

  /**
   * Handle creating a new calendar
   */
  function handleCreateCalendar() {
    isCalendarModalOpen = true;
  }

  /**
   * Handle event modal close
   */
  function handleEventModalClose() {
    isEventModalOpen = false;
    selectedDateForNewEvent = null;
  }

  /**
   * Handle calendar modal close
   */
  function handleCalendarModalClose() {
    isCalendarModalOpen = false;
  }

  /**
   * Handle event created
   */
  function handleEventCreated() {
    // Event was created successfully
    // Could add a toast notification here
  }

  /**
   * Handle calendar created
   */
  function handleCalendarCreated() {
    // Calendar was created successfully
    // Could add a toast notification here
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

<!-- Event Creation Modal -->
<CalendarEventModal
  isOpen={isEventModalOpen}
  {communityPubkey}
  selectedDate={selectedDateForNewEvent}
  onClose={handleEventModalClose}
  onEventCreated={handleEventCreated}
/>

<!-- Calendar Creation Modal -->
<CalendarCreationModal
  isOpen={isCalendarModalOpen}
  onClose={handleCalendarModalClose}
  onCalendarCreated={handleCalendarCreated}
/>
