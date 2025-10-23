<script>
	import { eventStore, pool } from '$lib/stores/nostr-infrastructure.svelte';
	import { manager } from '$lib/stores/accounts.svelte';
	import { appConfig } from '$lib/config.js';
	import { loadUserProfile } from '$lib/loaders';
	import { getProfilePicture } from 'applesauce-core/helpers';
	import NostrIdentifierParser from '$lib/components/shared/NostrIdentifierParser.svelte';

	/** @type {any} */
	let { communikeyEvent } = $props();

	// Reactive state
	/** @type {any[]} */
	let messages = $state([]);
	/** @type {any} */
	let activeUser = $state(null);
	/** @type {Map<string, any>} */
	let userProfiles = $state(new Map());
	let newMessage = $state('');
	let isLoading = $state(true);
	let isSending = $state(false);

	// Get community pubkey from communikey event
	let communityPubkey = $state(/** @type {string} */ (''));

	$effect(() => {
		communityPubkey = communikeyEvent?.pubkey || '';
	});

	// Subscribe to active user
	$effect(() => {
		const subscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});
		return () => subscription.unsubscribe();
	});

	// Subscribe to chat messages
	$effect(() => {
		if (!communityPubkey) return;

		isLoading = true;
		let initialLoadComplete = false;

		// Create a persistent subscription that continues after EOSE
		const subscription = pool
			.group(appConfig.calendar.defaultRelays)
			.subscription({ kinds: [9], '#h': [communityPubkey] })
			.subscribe({
				next: (response) => {
					if (response === 'EOSE') {
						console.log('End of stored events - switching to real-time mode');
						initialLoadComplete = true;
						isLoading = false;
					} else if (response && typeof response === 'object' && response.kind === 9) {
						// This is an actual event
						console.log('Received chat event:', response);

						// Add to eventStore for persistence
						eventStore.add(response);

						// Add message to list if not already present
						const existingIndex = messages.findIndex((m) => m.id === response.id);
						if (existingIndex === -1) {
							messages = [...messages, response].sort((a, b) => a.created_at - b.created_at);
						}

						// If this is the first event after EOSE, mark loading as complete
						if (initialLoadComplete && isLoading) {
							isLoading = false;
						}
					}
				},
				error: (error) => {
					console.error('Chat subscription error:', error);
					isLoading = false;
				}
			});

		return () => subscription.unsubscribe();
	});

	// Load profiles for message authors
	$effect(() => {
		const uniquePubkeys = [...new Set(messages.filter((m) => m && m.pubkey).map((m) => m.pubkey))];

		uniquePubkeys.forEach((pubkey) => {
			if (!userProfiles.has(pubkey)) {
				// Use the proper profile loader with kind 0 for user profiles
				const profileSubscription = loadUserProfile(0, pubkey).subscribe({
					next: (/** @type {any} */ profile) => {
						if (profile) {
							userProfiles.set(pubkey, profile);
							userProfiles = new Map(userProfiles); // Trigger reactivity
						}
					},
					error: (/** @type {any} */ error) => {
						console.error('Profile loading error:', error);
					}
				});

				// Store subscription for cleanup
				userProfiles.set(pubkey, { loading: true, subscription: profileSubscription });
				userProfiles = new Map(userProfiles);
			}
		});
	});

	// Send message function
	/**
	 * @param {Event} event
	 */
	async function sendMessage(event) {
		event.preventDefault();

		if (!activeUser || !newMessage.trim() || !communityPubkey) return;

		isSending = true;

		try {
			// Create kind 9 event with community h-tag
			const chatEvent = {
				kind: 9,
				content: newMessage.trim(),
				tags: [['h', communityPubkey]],
				created_at: Math.floor(Date.now() / 1000),
				pubkey: activeUser.pubkey
			};

			// Sign and publish the event
			const signedEvent = await activeUser.signer.signEvent(chatEvent);

			// Add immediately to local messages for instant UI feedback
			messages = [...messages, signedEvent].sort((a, b) => a.created_at - b.created_at);

			console.log('Chat event created:', signedEvent);

			try {
				const responses = await pool.publish(appConfig.calendar.defaultRelays, signedEvent);
				responses.forEach((response) => {
					if (response.ok) {
						console.log(`Event published successfully to ${response.from}`);
						eventStore.add(signedEvent);
					} else {
						console.log(`Failed to publish event to ${response.from}: ${response.message}`);
					}
				});
			} catch (error) {
				console.error('Error publishing to relays:', error);
			}

			// Clear input
			newMessage = '';
		} catch (error) {
			console.error('Failed to send message:', error);
			// TODO: Show error toast/notification
		} finally {
			isSending = false;
		}
	}

	// Format timestamp
	/**
	 * @param {number} timestamp
	 */
	function formatTimestamp(timestamp) {
		const date = new Date(timestamp * 1000);
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		if (diff < 60000) return 'now'; // Less than 1 minute
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m`; // Minutes
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`; // Hours
		return date.toLocaleDateString(); // Date
	}

	// Get user display name
	/**
	 * @param {string} pubkey
	 */
	function getUserDisplayName(pubkey) {
		if (!pubkey) return 'Unknown User';
		const profile = userProfiles.get(pubkey);
		if (profile && !profile.loading) {
			return profile.display_name || profile.name || pubkey.slice(0, 8) + '...';
		}
		return pubkey.slice(0, 8) + '...';
	}

	// Get user avatar
	/**
	 * @param {string} pubkey
	 */
	function getUserAvatar(pubkey) {
		if (!pubkey) return null;
		const profile = userProfiles.get(pubkey);
		if (profile && !profile.loading) {
			return getProfilePicture(profile);
		}
		return null;
	}

	// Auto-scroll to bottom when new messages arrive
	/** @type {HTMLElement} */
	let chatContainer;
	$effect(() => {
		if (chatContainer && messages.length > 0) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	});
</script>

<div class="flex flex-col rounded-lg border bg-base-100" style="height: calc(100vh - 20rem);">
	<!-- Chat header -->
	<div class="rounded-t-lg border-b bg-base-200 px-4 py-2">
		<h3 class="font-semibold text-base-content">Community Chat</h3>
		{#if isLoading}
			<div class="text-sm text-base-content/70">Loading messages...</div>
		{:else}
			<div class="text-sm text-base-content/70">{messages.length} messages</div>
		{/if}
	</div>

	<!-- Messages container -->
	<div bind:this={chatContainer} class="flex-1 space-y-4 overflow-y-auto p-4">
		{#if messages.length === 0 && !isLoading}
			<div class="py-8 text-center text-base-content/50">
				No messages yet. Be the first to say something!
			</div>
		{/if}

		{#each messages.filter((m) => m && m.id && m.pubkey && m.content) as message (message.id)}
			{@const isOwnMessage = activeUser && message.pubkey === activeUser.pubkey}
			<div class="chat {isOwnMessage ? 'chat-end' : 'chat-start'}">
				{#if !isOwnMessage}
					<div class="avatar chat-image">
						<div class="w-8 rounded-full">
							{#if getUserAvatar(message.pubkey)}
								<img src={getUserAvatar(message.pubkey)} alt={getUserDisplayName(message.pubkey)} />
							{:else}
								<div
									class="flex h-full w-full items-center justify-center bg-primary text-xs text-primary-content"
								>
									{getUserDisplayName(message.pubkey).charAt(0).toUpperCase()}
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<div class="chat-header mb-1 text-xs opacity-70">
					{#if !isOwnMessage}
						<span class="font-semibold">{getUserDisplayName(message.pubkey)}</span>
						<span class="mx-1">•</span>
					{/if}
					<time datetime={new Date(message.created_at * 1000).toISOString()}>
						{formatTimestamp(message.created_at)}
					</time>
				</div>

				<div class="chat-bubble {isOwnMessage ? 'chat-bubble-primary' : ''}">
					<NostrIdentifierParser text={message.content} />
				</div>
			</div>
		{/each}
	</div>

	<!-- Message input -->
	{#if activeUser}
		<form onsubmit={sendMessage} class="rounded-b-lg border-t bg-base-100 p-4">
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={newMessage}
					placeholder="Type a message..."
					class="input-bordered input flex-1"
					disabled={isSending}
					required
				/>
				<button type="submit" class="btn btn-primary" disabled={!newMessage.trim() || isSending}>
					{#if isSending}
						<span class="loading loading-sm loading-spinner"></span>
					{:else}
						Send
					{/if}
				</button>
			</div>
		</form>
	{:else}
		<div class="rounded-b-lg border-t bg-base-100 p-4">
			<div class="text-center text-base-content/70">
				<p class="mb-2">Sign in to participate in the chat</p>
				<!-- TODO: Add login button/component -->
			</div>
		</div>
	{/if}
</div>
