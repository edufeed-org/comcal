<!--
	CalendarMapView Component
	Displays a full-screen map with multiple event markers
	Uses MapLibre GL with OpenFreeMap Liberty style
-->
<script>
	import { onMount } from 'svelte';
	import { MapLibre, Marker, Popup } from 'svelte-maplibre';
	import { parseLocation } from '$lib/helpers/geocoding.js';
	import { encodeEventToNaddr } from '$lib/helpers/nostrUtils.js';
	import { formatCalendarDate, filterEventsByViewMode } from '$lib/helpers/calendar.js';
	import { MapIcon, CalendarIcon, ClockIcon } from '$lib/components/icons';
	import * as m from '$lib/paraglide/messages';

	/**
	 * @typedef {import('$lib/types/calendar.js').CalendarEvent} CalendarEvent
	 * @typedef {import('$lib/types/calendar.js').CalendarViewMode} CalendarViewMode
	 */

	let { events = [], viewMode = /** @type {CalendarViewMode} */ ('month'), currentDate = new Date() } = $props();

	/** @type {{ event: CalendarEvent, coordinates: { lat: number, lng: number } }[]} */
	let eventsWithCoordinates = $state([]);
	let loading = $state(true);
	let error = $state(/** @type {string | null} */ (null));

	// Map center and bounds
	let mapCenter = $state(/** @type {[number, number]} */ ([0, 0]));
	let mapZoom = $state(2);
	let mapBounds = $state(/** @type {[[number, number], [number, number]] | null} */ (null));

	// Filter events based on current view mode and date using shared helper
	let filteredEvents = $derived.by(() => filterEventsByViewMode(events, viewMode, currentDate));

	/**
	 * Format event date and time for display
	 * @param {CalendarEvent} event
	 * @returns {string}
	 */
	function formatEventDateTime(event) {
		if (!event.start) return '';
		
		const startDate = new Date(event.start * 1000);
		const dateStr = formatCalendarDate(startDate, 'short');
		const timeStr = formatCalendarDate(startDate, 'time');
		
		return `${dateStr} at ${timeStr}`;
	}

	/**
	 * Calculate map bounds to fit all markers
	 * @param {{ event: CalendarEvent, coordinates: { lat: number, lng: number } }[]} eventsWithCoords
	 */
	function calculateMapBounds(eventsWithCoords) {
		if (eventsWithCoords.length === 0) {
			// World view
			mapCenter = [0, 0];
			mapZoom = 2;
			mapBounds = null;
			return;
		}

		if (eventsWithCoords.length === 1) {
			// Single event - center on it
			const coords = eventsWithCoords[0].coordinates;
			mapCenter = [coords.lng, coords.lat];
			mapZoom = 13;
			mapBounds = null;
			return;
		}

		// Multiple events - calculate bounds
		const lngs = eventsWithCoords.map(e => e.coordinates.lng);
		const lats = eventsWithCoords.map(e => e.coordinates.lat);

		const minLng = Math.min(...lngs);
		const maxLng = Math.max(...lngs);
		const minLat = Math.min(...lats);
		const maxLat = Math.max(...lats);

		mapBounds = [
			[minLng, minLat], // Southwest
			[maxLng, maxLat]  // Northeast
		];
		mapCenter = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
		mapZoom = 10; // Will be overridden by fitBounds
	}

	/**
	 * Extract coordinates from filtered events
	 */
	async function processEventLocations() {
		loading = true;
		error = null;
		
		/** @type {{ event: CalendarEvent, coordinates: { lat: number, lng: number } }[]} */
		const processed = [];

		for (const event of filteredEvents) {
			try {
				const coords = await parseLocation(event.location, event.geohash);
				if (coords) {
					processed.push({
						event,
						coordinates: { lat: coords.lat, lng: coords.lng }
					});
				}
			} catch (err) {
				console.warn(`Failed to parse location for event ${event.id}:`, err);
			}
		}

		eventsWithCoordinates = processed;
		calculateMapBounds(processed);
		loading = false;

		console.log(`📍 CalendarMapView: Processed ${processed.length}/${filteredEvents.length} events with locations (${filteredEvents.length}/${events.length} in view)`);
	}

	// Process filtered events when they change
	$effect(() => {
		processEventLocations();
	});
</script>

<div class="calendar-map-view">
	{#if loading}
		<div class="map-loading">
			<span class="loading loading-spinner loading-lg"></span>
			<p class="text-sm mt-3">{m.calendar_map_loading()}</p>
		</div>
	{:else if error}
		<div class="map-error">
			<MapIcon class_="w-16 h-16 opacity-30 mb-4" />
			<h3 class="text-lg font-medium mb-2">{m.calendar_map_error_title()}</h3>
			<p class="text-base-content/60">{error}</p>
		</div>
	{:else if eventsWithCoordinates.length === 0 && events.length > 0}
		<div class="map-empty">
			<MapIcon class_="w-16 h-16 opacity-30 mb-4" />
			<h3 class="text-lg font-medium mb-2">{m.calendar_map_empty_locations_title()}</h3>
			<p class="text-base-content/60 max-w-md mb-4">
				{m.calendar_map_empty_locations_desc({ count: events.length, plural: events.length === 1 ? '' : 'en' })}
			</p>
		</div>
	{:else if events.length === 0}
		<div class="map-empty">
			<CalendarIcon class_="w-16 h-16 opacity-30 mb-4" />
			<h3 class="text-lg font-medium mb-2">{m.calendar_map_empty_events_title()}</h3>
			<p class="text-base-content/60 mb-4">
				{m.calendar_map_empty_events_desc()}
			</p>
		</div>
	{:else}
		<div class="map-container">
			<MapLibre
				style="https://tiles.openfreemap.org/styles/liberty"
				center={mapCenter}
				zoom={mapZoom}
				{...(mapBounds ? { bounds: mapBounds, fitBoundsOptions: { padding: 50, maxZoom: 15 } } : {})}
				class="map"
			>
				{#each eventsWithCoordinates as item (item.event.id)}
					<Marker 
						lngLat={[item.coordinates.lng, item.coordinates.lat]}
					>
						<div class="map-pin">📍</div>
						<Popup openOn="click" closeButton={true} offset={[0, -10]}>
							<div class="event-popup">
								<h3 class="text-base font-semibold mb-2 leading-tight">
									<a 
										href="/calendar/event/{encodeEventToNaddr(item.event.originalEvent)}" 
										class="hover:text-primary transition-colors"
									>
										{item.event.title}
									</a>
								</h3>
								
								<div class="text-sm text-base-content/70 space-y-1 mb-3">
									<div class="flex items-center gap-2">
										<ClockIcon class_="w-4 h-4 flex-shrink-0" />
										<time class="flex-1">{formatEventDateTime(item.event)}</time>
									</div>
									
									{#if item.event.location}
										<div class="flex items-start gap-2">
											<MapIcon class_="w-4 h-4 flex-shrink-0 mt-0.5" />
											<span class="flex-1 break-words">{item.event.location}</span>
										</div>
									{/if}
								</div>
								
								<a 
									href="/calendar/event/{encodeEventToNaddr(item.event.originalEvent)}"
									class="btn btn-xs btn-primary btn-block"
								>
									View Event Details →
								</a>
							</div>
						</Popup>
					</Marker>
				{/each}
			</MapLibre>
		</div>
	{/if}
</div>

<style>
	.calendar-map-view {
		width: 100%;
		height: 600px;
		position: relative;
		border-radius: 0 0 0.5rem 0.5rem;
		overflow: hidden;
		background: var(--fallback-b2, oklch(var(--b2)));
	}

	.map-loading,
	.map-error,
	.map-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 2rem;
		text-align: center;
		color: var(--fallback-bc, oklch(var(--bc) / 0.6));
	}

	.map-container {
		position: relative;
		width: 100%;
		height: 100%;
	}

	:global(.calendar-map-view .map) {
		width: 100%;
		height: 100%;
	}

	/* Popup styling */
	:global(.calendar-map-view .event-popup) {
		min-width: 250px;
		max-width: 300px;
		padding: 1rem;
		color: #1a1a1a; /* Dark text for readability */
	}

	:global(.calendar-map-view .event-popup h3) {
		color: #000000; /* Darker heading */
	}

	:global(.calendar-map-view .event-popup h3 a) {
		color: inherit;
	}

	:global(.calendar-map-view .event-popup .text-sm) {
		color: #4a4a4a !important; /* Override for better contrast */
	}

	:global(.calendar-map-view .maplibregl-popup-content) {
		padding: 0;
		border-radius: 0.5rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		background: #ffffff; /* Explicit white background */
	}

	:global(.calendar-map-view .maplibregl-popup-close-button) {
		font-size: 1.5rem;
		padding: 0.5rem;
		color: #666666;
	}

	:global(.calendar-map-view .maplibregl-popup-close-button:hover) {
		color: #000000;
		background: transparent;
	}

	/* Custom pin marker */
	:global(.calendar-map-view .map-pin) {
		font-size: 2rem;
		line-height: 1;
		cursor: pointer;
		transition: transform 0.2s ease;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
		user-select: none;
	}

	:global(.calendar-map-view .map-pin:hover) {
		transform: scale(1.2);
	}

	/* Attribution styling */
	:global(.calendar-map-view .maplibregl-ctrl-attrib) {
		background: rgba(255, 255, 255, 0.8);
		backdrop-filter: blur(4px);
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.calendar-map-view {
			height: 500px;
		}

		:global(.calendar-map-view .event-popup) {
			min-width: 200px;
			max-width: 250px;
		}
	}
</style>
