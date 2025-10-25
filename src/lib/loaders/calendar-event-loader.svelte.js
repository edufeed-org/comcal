/**
 * Calendar Event Loader - Composable Hook
 * Unified interface for loading calendar events from various sources
 * Follows the project's EventStore intelligence pattern
 */

import { eventStore, pool } from '$lib/stores/nostr-infrastructure.svelte';
import { TimelineModel } from 'applesauce-core/models';
import { onlyEvents } from 'applesauce-relay/operators';
import { mapEventsToStore, mapEventsToTimeline } from 'applesauce-core/observable';
import { map } from 'rxjs';
import { getCalendarEventMetadata, parseAddressReference } from '$lib/helpers/eventUtils';
import { getCalendarEventTitle } from 'applesauce-core/helpers/calendar-event';
import {
	calendarTimelineLoader,
	targetedPublicationTimelineLoader,
	userDeletionLoader
} from '$lib/loaders';
import { appConfig } from '$lib/config.js';
import { calendarStore } from '$lib/stores/calendar-events.svelte.js';
import { parseCalendarFilters } from '$lib/helpers/urlParams.js';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { CommunityCalendarEventModel } from '$lib/models';

/**
 * @typedef {Object} LoaderOptions
 * @property {(events: any[]) => void} onEventsUpdate - Callback when events update
 * @property {(loading: boolean) => void} onLoadingChange - Callback when loading state changes
 * @property {(error: string | null) => void} onError - Callback when error occurs
 * @property {(errors: string[]) => void} [onResolutionErrors] - Optional callback for resolution errors
 */

/**
 * @typedef {Object} EventLoaderAPI
 * @property {(relays?: string[], authors?: string[]) => void} loadGlobal - Load global events
 * @property {(calendar: any) => void} loadByCalendar - Load calendar-specific events
 * @property {(pubkey: string, relays?: string[]) => void} loadByAuthor - Load events by author
 * @property {(pubkey: string) => void} loadByCommunity - Load community events
 * @property {(relays: string[], authors?: string[]) => void} loadByRelays - Load from specific relays
 * @property {() => void} cleanup - Clean up all subscriptions
 */

/**
 * Create a calendar event loader with unified loading interface
 * @param {LoaderOptions} options - Configuration options
 * @returns {EventLoaderAPI}
 */
export function useCalendarEventLoader(options) {
	// Subscription management
	let subscription = $state();
	let relaySubscription = $state();
	let backgroundLoaderSubscription = $state();
	let targetedPublicationSubscription = $state();
	let deletionSubscriptions = $state.raw(/** @type {SvelteMap<string, any>} */ (new SvelteMap()));

	// Internal state
	const eventMap = new SvelteMap();
	const resolutionErrors = $state.raw(/** @type {string[]} */ ([]));

	/**
	 * Clean up a specific subscription
	 * @param {any} sub
	 */
	function cleanupSubscription(sub) {
		if (sub) {
			sub.unsubscribe();
		}
		return null;
	}

	/**
	 * Clean up all subscriptions
	 */
	function cleanupAll() {
		subscription = cleanupSubscription(subscription);
		relaySubscription = cleanupSubscription(relaySubscription);
		backgroundLoaderSubscription = cleanupSubscription(backgroundLoaderSubscription);
		targetedPublicationSubscription = cleanupSubscription(targetedPublicationSubscription);
		
		// Clean up deletion subscriptions
		deletionSubscriptions.forEach((sub) => cleanupSubscription(sub));
		deletionSubscriptions.clear();
		
		eventMap.clear();
		resolutionErrors.length = 0;
	}

	/**
	 * Start background loader
	 */
	function startBackgroundLoader() {
		if (!backgroundLoaderSubscription) {
			console.log('📅 EventLoader: Starting background loader');
			backgroundLoaderSubscription = calendarTimelineLoader().subscribe();
		}
	}

	/**
	 * Stop background loader
	 */
	function stopBackgroundLoader() {
		if (backgroundLoaderSubscription) {
			console.log('📅 EventLoader: Stopping background loader');
			backgroundLoaderSubscription = cleanupSubscription(backgroundLoaderSubscription);
		}
	}

	/**
	 * Load global events using EventStore
	 * @param {string[]} [relays] - Optional relay URLs to use
	 * @param {string[]} [authors] - Optional author pubkeys to filter by
	 */
	function loadGlobal(relays, authors) {
		const selectedRelays = relays || [];
		const selectedAuthors = authors || [];

		console.log('📅 EventLoader: Loading global events', {
			relays: selectedRelays.length,
			authors: selectedAuthors.length
		});

		options.onLoadingChange(true);
		eventMap.clear();

		// If relay filtering OR author filtering is active, use pool.subscription
		if (selectedRelays.length > 0 || selectedAuthors.length > 0) {
			console.log('📅 EventLoader: Using filtered relay subscription');
			// Stop other subscriptions
			relaySubscription = cleanupSubscription(relaySubscription);
			stopBackgroundLoader();

			// Use default relays from config if no specific relays selected
			const relaysToUse =
				selectedRelays.length > 0 ? selectedRelays : appConfig.calendar.defaultRelays;
			loadByRelays(relaysToUse, selectedAuthors);
		} else {
			// Default behavior: use EventStore model
			console.log('📅 EventLoader: Using default EventStore');
			relaySubscription = cleanupSubscription(relaySubscription);
			startBackgroundLoader();

			const filter = { kinds: [31922, 31923], limit: 50 };

			subscription = eventStore.model(TimelineModel, filter).subscribe((timeline) => {
				const mapped = timeline.map(getCalendarEventMetadata);
				options.onEventsUpdate(mapped);
				options.onLoadingChange(false);
			});
		}
	}

	/**
	 * Load events from specific calendar
	 * @param {any} calendar - Calendar object with eventReferences
	 */
	function loadByCalendar(calendar) {
		if (!calendar) {
			console.warn('📅 EventLoader: No calendar provided');
			return;
		}

		if (!calendar.eventReferences || calendar.eventReferences.length === 0) {
			console.log('📅 EventLoader: No event references found for calendar:', calendar.title);
			options.onEventsUpdate([]);
			return;
		}

		console.log(
			'📅 EventLoader: Loading calendar-specific events:',
			calendar.eventReferences.length
		);

		options.onLoadingChange(true);
		eventMap.clear();

		// Stop other subscriptions
		relaySubscription = cleanupSubscription(relaySubscription);
		stopBackgroundLoader();

		calendar.eventReferences.forEach((/** @type {string} */ addressRef, /** @type {number} */ index) => {
			const parsed = parseAddressReference(addressRef);

			if (!parsed) {
				console.warn('📅 EventLoader: Invalid address reference:', addressRef);
				return;
			}

			console.log(
				`📅 EventLoader: Loading event ${index + 1}/${calendar.eventReferences.length}:`,
				parsed
			);

			const loader = eventStore.addressableLoader?.({
				kind: parsed.kind,
				pubkey: parsed.pubkey,
				identifier: parsed.dTag
			});

			if (loader) {
				loader.subscribe((/** @type {any} */ event) => {
					console.log(
						`📅 EventLoader: Successfully loaded event:`,
						event.id,
						getCalendarEventTitle(event)
					);
					const calendarEvent = getCalendarEventMetadata(event);

					if (!eventMap.has(calendarEvent.id)) {
						eventMap.set(calendarEvent.id, calendarEvent);
						options.onEventsUpdate(Array.from(eventMap.values()));
						console.log(`📅 EventLoader: Added unique event, total: ${eventMap.size}`);
					} else {
						console.log(`📅 EventLoader: Skipped duplicate event:`, calendarEvent.id);
					}
				});
			}
		});
	}

	/**
	 * Load events by author
	 * @param {string} pubkey - The author's public key
	 * @param {string[]} [relays] - Optional relay URLs to use
	 */
	function loadByAuthor(pubkey, relays) {
		const selectedRelays = relays || [];

		console.log('📅 EventLoader: Loading events by author:', pubkey, {
			relays: selectedRelays.length
		});

		options.onLoadingChange(true);
		eventMap.clear();

		if (selectedRelays.length > 0) {
			// Use specific relays
			console.log('📅 EventLoader: Loading author events from selected relays:', selectedRelays);
			relaySubscription = cleanupSubscription(relaySubscription);

			relaySubscription = pool
				.subscription(selectedRelays, {
					kinds: [31922, 31923],
					authors: [pubkey],
					limit: 50
				})
				.pipe(
					onlyEvents(),
					mapEventsToStore(eventStore),
					mapEventsToTimeline(),
					map((timeline) => [...timeline])
				)
				.subscribe({
					next: (timeline) => {
						console.log(
							'📅 EventLoader: Received timeline with',
							timeline.length,
							'events by author'
						);
						const mapped = timeline.map(getCalendarEventMetadata);
						options.onEventsUpdate(mapped);
						options.onLoadingChange(false);
					},
					error: (err) => {
						console.error('📅 EventLoader: Relay subscription error:', err);
						options.onError('Failed to load events from relays');
						options.onLoadingChange(false);
					}
				});
		} else {
			// Use EventStore
			console.log('📅 EventLoader: Loading author events from EventStore');
			relaySubscription = cleanupSubscription(relaySubscription);

			const filter = { kinds: [31922, 31923], authors: [pubkey], limit: 50 };

			subscription = eventStore.model(TimelineModel, filter).subscribe((timeline) => {
				console.log('📅 EventLoader: Loaded', timeline.length, 'events by author from EventStore');
				const mapped = timeline.map(getCalendarEventMetadata);
				options.onEventsUpdate(mapped);
				options.onLoadingChange(false);
			});
		}
	}

	/**
	 * Load community events using the CommunityCalendarEventModel
	 * @param {string} communityPubkey - The community's public key
	 */
	function loadByCommunity(communityPubkey) {
		if (!communityPubkey) {
			console.warn('📅 EventLoader: No communityPubkey provided for community mode');
			return;
		}

		console.log('📅 EventLoader: Loading community events for:', communityPubkey);

		options.onLoadingChange(true);
		options.onError(null);
		eventMap.clear();

		// Clean up all subscriptions
		cleanupAll();

		try {
			// Start loaders to populate EventStore with required data
			// 1. Direct community events (kinds 31922, 31923 with h-tag)
			backgroundLoaderSubscription = eventStore.timeline({
				kinds: [31922, 31923],
				'#h': [communityPubkey],
				limit: 50
			}).subscribe();
			
			// 2. Targeted publications (kind 30222 referencing community)
			targetedPublicationSubscription = targetedPublicationTimelineLoader(communityPubkey)().subscribe();
			
			// Note: The CommunityCalendarEventModel will automatically load referenced
			// calendar events on-demand, so no need for a global calendar loader here

			// Use the CommunityCalendarEventModel to reactively combine all data
			subscription = eventStore.model(CommunityCalendarEventModel, communityPubkey).subscribe({
				next: (events) => {
					console.log(`📅 EventLoader: Received ${events.length} community events from model`);
					options.onEventsUpdate(events);
					options.onLoadingChange(false);
					
					// Load deletion events for all unique authors
					// EventStore will automatically remove deleted events from all subscriptions
					const authorPubkeys = new SvelteSet(events.map(e => e.originalEvent.pubkey));
					
					authorPubkeys.forEach((pubkey) => {
						// Skip if already loading deletions for this author
						if (deletionSubscriptions.has(pubkey)) return;
						
						const deletionLoader = userDeletionLoader(pubkey);
						const loaderResult = deletionLoader();
						
						// Handle both Observable and Promise returns
						const sub = loaderResult.subscribe(/** @param {any} deletionEvent */ (deletionEvent) => {
							if (deletionEvent) {
								eventStore.add(deletionEvent);
							}
						});
						
						deletionSubscriptions.set(pubkey, sub);
					});
				},
				error: (err) => {
					console.error('📅 EventLoader: Error in community calendar model:', err);
					options.onError('Failed to load community calendar events');
					options.onLoadingChange(false);
				}
			});
		} catch (err) {
			console.error('📅 EventLoader: Error creating community subscriptions:', err);
			options.onError('Failed to connect to event stream');
			options.onLoadingChange(false);
		}
	}

	/**
	 * Load events from specific relays
	 * @param {string[]} relays - Relay URLs to use
	 * @param {string[]} [authors] - Optional author pubkeys to filter by
	 */
	function loadByRelays(relays, authors) {
		console.log('📅 EventLoader: Loading from specific relays', {
			relays: relays.length,
			authors: authors?.length || 0
		});

		options.onLoadingChange(true);
		eventMap.clear();

		stopBackgroundLoader();
		relaySubscription = cleanupSubscription(relaySubscription);

		/** @type {{kinds: number[], limit: number, authors?: string[]}} */
		const filter = {
			kinds: [31922, 31923],
			limit: 50
		};

		if (authors && authors.length > 0) {
			filter.authors = authors;
			console.log(`📅 EventLoader: Filtering by ${authors.length} authors from follow lists`);
		}

		relaySubscription = pool
			.subscription(relays, filter)
			.pipe(
				onlyEvents(),
				mapEventsToStore(eventStore),
				mapEventsToTimeline(),
				map((timeline) => [...timeline])
			)
			.subscribe({
				next: (timeline) => {
					console.log('📅 EventLoader: Received timeline with', timeline.length, 'events');
					const mapped = timeline.map(getCalendarEventMetadata);
					options.onEventsUpdate(mapped);
					options.onLoadingChange(false);
				},
				error: (err) => {
					console.error('📅 EventLoader: Relay subscription error:', err);
					options.onError('Failed to load events from relays');
					options.onLoadingChange(false);
				}
			});
	}

	return {
		loadGlobal,
		loadByCalendar,
		loadByAuthor,
		loadByCommunity,
		loadByRelays,
		cleanup: cleanupAll
	};
}

/**
 * Hook to sync URL parameters with calendar store
 * Handles tags, relays, authors, search, and view mode synchronization
 * @param {any} pageStore - Svelte $page store
 * @param {(mode: 'calendar' | 'list' | 'map') => void} onPresentationViewModeChange - Callback for view mode changes
 */
export function useCalendarUrlSync(pageStore, onPresentationViewModeChange) {
	$effect(() => {
		// This effect tracks pageStore.url and re-runs whenever the URL changes
		const urlFilters = /** @type {any} */ (parseCalendarFilters(pageStore.url.searchParams));
		console.log('📅 URLSync: URL changed, syncing filters:', urlFilters);

		// Sync tags - normalize to lowercase for consistent filtering
		if (urlFilters?.tags && Array.isArray(urlFilters.tags)) {
			if (urlFilters.tags.length > 0) {
				// Normalize tags to lowercase to match filter logic
				const normalizedTags = urlFilters.tags.map((/** @type {string} */ tag) =>
					tag.toLowerCase().trim()
				);
				calendarStore.setSelectedTags(normalizedTags);
			} else {
				calendarStore.clearSelectedTags();
			}
		} else {
			calendarStore.clearSelectedTags();
		}

		// Sync relays
		if (urlFilters?.relays && Array.isArray(urlFilters.relays)) {
			if (urlFilters.relays.length > 0) {
				calendarStore.setSelectedRelays(urlFilters.relays);
			} else {
				calendarStore.setSelectedRelays([]);
			}
		} else {
			calendarStore.setSelectedRelays([]);
		}

		// Sync authors (follow lists)
		if (urlFilters?.authors && Array.isArray(urlFilters.authors)) {
			if (urlFilters.authors.length > 0) {
				calendarStore.setSelectedFollowListIds(urlFilters.authors);
			} else {
				calendarStore.setSelectedFollowListIds([]);
			}
		} else {
			calendarStore.setSelectedFollowListIds([]);
		}

		// Sync search query
		if (
			urlFilters?.search &&
			typeof urlFilters.search === 'string' &&
			urlFilters.search.trim()
		) {
			calendarStore.setSearchQuery(urlFilters.search);
		} else {
			calendarStore.setSearchQuery('');
		}

		// Sync presentation view mode
		if (urlFilters?.view && typeof urlFilters.view === 'string') {
			onPresentationViewModeChange(
				/** @type {'calendar' | 'list' | 'map'} */ (urlFilters.view)
			);
		} else {
			onPresentationViewModeChange('calendar'); // Default view
		}
	});
}
