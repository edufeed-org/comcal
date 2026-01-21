<script>
	import { EventFactory } from 'applesauce-factory';
	import { publishEvent } from '$lib/services/publish-service.js';
	import { getPrimaryWriteRelay } from '$lib/services/relay-service.svelte.js';
	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import { generateCommentTags } from '$lib/helpers/commentTags.js';
	import * as m from '$lib/paraglide/messages';

	/**
	 * @typedef {Object} CommentInputProps
	 * @property {any} rootEvent - The root event being commented on
	 * @property {any} [parentItem] - The parent item (null/undefined for top-level, comment object for replies)
	 * @property {any} activeUser - The currently active user with signer
	 * @property {string} [placeholder] - Placeholder text for the input
	 * @property {(event: any) => void} [onCommentPosted] - Callback when comment is successfully posted
	 * @property {(() => void)|null} [onCancel] - Callback when cancel is clicked (for reply forms)
	 * @property {boolean} [autoFocus] - Whether to auto-focus the textarea
	 */

	/** @type {CommentInputProps} */
	let {
		rootEvent,
		parentItem = null,
		activeUser,
		placeholder = 'Write a comment...',
		onCommentPosted = (/** @type {any} */ _event) => {},
		onCancel = null,
		autoFocus = false
	} = $props();

	let content = $state('');
	let isPosting = $state(false);
	let error = $state('');
	let textareaElement = $state(/** @type {HTMLTextAreaElement|null} */ (null));

	// Auto-focus if requested
	$effect(() => {
		if (autoFocus && textareaElement) {
			textareaElement.focus();
		}
	});

	/**
	 * Post the comment
	 */
	async function handleSubmit(/** @type {Event} */ e) {
		e.preventDefault();

		if (!activeUser || !content.trim() || !rootEvent) return;

		isPosting = true;
		error = '';

		try {
			// Create EventFactory for the user
			const factory = new EventFactory({
				signer: activeUser.signer
			});

			// Get relay hint for the root event author
			const relayHint = await getPrimaryWriteRelay(rootEvent.pubkey);

			// Generate NIP-22 tags
			const tags = generateCommentTags(
				rootEvent,
				parentItem,
				relayHint
			);

			// Create the comment event
			const commentEvent = await factory.build({
				kind: 1111,
				content: content.trim(),
				tags
			});

			// Sign the event
			const signedEvent = await factory.sign(commentEvent);

			console.log('Comment event created:', signedEvent);

			// Publish using outbox model (tag root event author for discoverability)
			const result = await publishEvent(signedEvent, [rootEvent.pubkey]);

			if (result.success) {
				console.log('Comment published successfully');
				eventStore.add(signedEvent);

				// Clear input
				content = '';

				// Call callback
				onCommentPosted(signedEvent);
			} else {
				console.error('Failed to publish comment');
				error = m.comments_input_publish_error();
			}
		} catch (err) {
			console.error('Failed to post comment:', err);
			error = m.comments_input_generic_error();
		} finally {
			isPosting = false;
		}
	}
</script>

<form onsubmit={handleSubmit} class="space-y-2">
	<textarea
		bind:this={textareaElement}
		bind:value={content}
		{placeholder}
		class="textarea textarea-bordered w-full"
		rows="3"
		disabled={isPosting}
		required
	></textarea>

	{#if error}
		<div class="alert alert-error">
			<span>{error}</span>
		</div>
	{/if}

	<div class="flex justify-end gap-2">
		{#if onCancel}
			<button type="button" class="btn btn-ghost" onclick={onCancel} disabled={isPosting}>
				{m.comments_input_cancel_button()}
			</button>
		{/if}
		<button type="submit" class="btn btn-primary" disabled={!content.trim() || isPosting}>
			{#if isPosting}
				<span class="loading loading-sm loading-spinner"></span>
				{m.comments_input_posting()}
			{:else}
				{m.comments_input_post_button()}
			{/if}
		</button>
	</div>
</form>
