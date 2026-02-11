<!--
  EventManagementActions Component
  Reusable component for event edit/delete actions
-->

<script>
  import { showToast } from '$lib/helpers/toast.js';
  import { deleteCalendarEvent } from '$lib/helpers/eventDeletion.js';
  import { EditIcon, TrashIcon } from '$lib/components/icons';
  import * as m from '$lib/paraglide/messages';

  /**
   * @typedef {import('../../types/calendar.js').CalendarEvent} CalendarEvent
   */

  /** @type {{ event: CalendarEvent, activeUser: any, onEdit: () => void, onDeleteSuccess: () => void }} */
  let { event, activeUser, onEdit, onDeleteSuccess } = $props();

  // Delete state
  let isDeletingEvent = $state(false);
  let showDeleteConfirmation = $state(false);

  /**
   * Handle event deletion
   */
  async function handleDeleteEvent() {
    if (!activeUser || !event) return;

    isDeletingEvent = true;
    let success = false;

    try {
      const result = await deleteCalendarEvent(event, activeUser);

      if (result.success) {
        showToast(m.event_management_delete_success(), 'success');
        showDeleteConfirmation = false;
        success = true;
        // Call the parent's success callback
        if (onDeleteSuccess) {
          onDeleteSuccess();
        }
      } else {
        showToast(result.error || m.event_management_delete_failed(), 'error');
      }
    } catch (error) {
      console.error('Failed to delete event:', error);
      showToast(m.event_management_delete_error(), 'error');
    } finally {
      isDeletingEvent = false;
      if (!success) {
        showDeleteConfirmation = false;
      }
    }
  }
</script>

<!-- Edit/Delete Dropdown -->
<div class="dropdown dropdown-end">
  <button
    class="btn btn-circle btn-ghost btn-sm"
    title={m.event_management_manage()}
    aria-label={m.event_management_manage()}
  >
    <EditIcon class="h-5 w-5" />
  </button>
  <ul
    class="dropdown-content menu z-[1] w-52 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
  >
    <li>
      <button onclick={onEdit} class="flex items-center gap-2">
        <EditIcon class="h-4 w-4" />
        <span>{m.event_management_edit()}</span>
      </button>
    </li>
    <li>
      <button
        onclick={() => (showDeleteConfirmation = true)}
        class="flex items-center gap-2 text-error hover:bg-error/10"
      >
        <TrashIcon class="h-4 w-4" />
        <span>{m.event_management_delete()}</span>
      </button>
    </li>
  </ul>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirmation && event}
  <div class="modal-open modal">
    <div class="modal-box">
      <h3 class="text-lg font-bold">{m.event_management_delete_confirm_title()}</h3>
      <p class="py-4">
        {m.event_management_delete_confirm_text()} <strong>{event.title}</strong>?
        <br />
        {m.event_management_delete_cannot_undo()}
      </p>
      <div class="modal-action">
        <button
          class="btn"
          onclick={() => (showDeleteConfirmation = false)}
          disabled={isDeletingEvent}
        >
          {m.common_cancel()}
        </button>
        <button class="btn btn-error" onclick={handleDeleteEvent} disabled={isDeletingEvent}>
          {#if isDeletingEvent}
            <span class="loading loading-sm loading-spinner"></span>
            {m.event_management_deleting()}
          {:else}
            {m.event_management_delete()}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
