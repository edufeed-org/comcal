<!--
  EventManagementActions Component
  Reusable component for event edit/delete actions
-->

<script>
	import { showToast } from '$lib/helpers/toast.js';
	import { deleteCalendarEvent } from '$lib/helpers/eventDeletion.js';
	import { EditIcon, TrashIcon } from '$lib/components/icons';

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
				showToast('Event deleted successfully', 'success');
				showDeleteConfirmation = false;
				success = true;
				// Call the parent's success callback
				if (onDeleteSuccess) {
					onDeleteSuccess();
				}
			} else {
				showToast(result.error || 'Failed to delete event', 'error');
			}
		} catch (error) {
			console.error('Failed to delete event:', error);
			showToast('An error occurred while deleting the event', 'error');
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
		tabindex="0"
		class="btn btn-circle btn-ghost btn-sm"
		role="button"
		title="Manage event"
		aria-label="Manage event"
	>
		<EditIcon class_="w-5 h-5" />
	</button>
	<ul
		tabindex="0"
		class="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow-lg border border-base-300"
	>
		<li>
			<button onclick={onEdit} class="flex items-center gap-2">
				<EditIcon class="w-4 h-4" />
				<span>Edit Event</span>
			</button>
		</li>
		<li>
			<button
				onclick={() => (showDeleteConfirmation = true)}
				class="flex items-center gap-2 text-error hover:bg-error/10"
			>
				<TrashIcon class="w-4 h-4" />
				<span>Delete Event</span>
			</button>
		</li>
	</ul>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirmation && event}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete Event?</h3>
			<p class="py-4">
				Are you sure you want to delete <strong>{event.title}</strong>?
				<br />
				This action cannot be undone.
			</p>
			<div class="modal-action">
				<button
					class="btn"
					onclick={() => (showDeleteConfirmation = false)}
					disabled={isDeletingEvent}
				>
					Cancel
				</button>
				<button class="btn btn-error" onclick={handleDeleteEvent} disabled={isDeletingEvent}>
					{#if isDeletingEvent}
						<span class="loading loading-spinner loading-sm"></span>
						Deleting...
					{:else}
						Delete Event
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
