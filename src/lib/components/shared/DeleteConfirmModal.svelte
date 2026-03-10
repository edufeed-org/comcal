<!--
  DeleteConfirmModal Component
  Reusable delete confirmation modal with i18n support
-->

<script>
  import * as m from '$lib/paraglide/messages';

  /**
   * @typedef {Object} Props
   * @property {boolean} open - Whether the modal is visible
   * @property {string} title - Modal title (e.g. "Delete Article?")
   * @property {string} itemName - Name of the item being deleted (shown bold)
   * @property {boolean} isDeleting - Loading state
   * @property {() => void} onconfirm - Called when user confirms deletion
   * @property {() => void} oncancel - Called when user cancels
   */

  /** @type {Props} */
  let { open, title, itemName, isDeleting, onconfirm, oncancel } = $props();
</script>

{#if open}
  <div class="modal-open modal">
    <div class="modal-box">
      <h3 class="text-lg font-bold">{title}</h3>
      <p class="py-4">
        {m.delete_confirm_text()} <strong>{itemName}</strong>?
        <br />
        {m.delete_confirm_cannot_undo()}
      </p>
      <div class="modal-action">
        <button class="btn" onclick={oncancel} disabled={isDeleting}>
          {m.common_cancel()}
        </button>
        <button class="btn btn-error" onclick={onconfirm} disabled={isDeleting}>
          {#if isDeleting}
            <span class="loading loading-sm loading-spinner"></span>
            {m.delete_confirm_deleting()}
          {:else}
            {m.common_delete()}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
