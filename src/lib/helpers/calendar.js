/**
 * Calendar Helper Functions
 * Utilities for date formatting, event management, and calendar operations
 */

import { appConfig } from '../config.js';

/**
 * @typedef {import('../types/calendar.js').CalendarEvent} CalendarEvent
 * @typedef {import('../types/calendar.js').EventFormData} EventFormData
 */

/**
 * Format a date for calendar display
 * @param {Date} date - Date to format
 * @param {string} format - Format string ('YYYY-MM-DD', 'MM/DD', 'full', etc.)
 * @returns {string} Formatted date string
 */
export function formatCalendarDate(date, format) {
	if (!date || !(date instanceof Date)) return '';

	switch (format) {
		case 'YYYY-MM-DD':
			return date.toISOString().split('T')[0];
		case 'MM/DD':
			return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
		case 'full':
			return date.toLocaleDateString('en-US', {
				weekday: 'long',
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
		case 'short':
			return date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric'
			});
		case 'time':
			return date.toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
			});
		default:
			return date.toLocaleDateString();
	}
}

/**
 * Get array of dates for week view
 * @param {Date} date - Reference date (any day in the week)
 * @returns {Date[]} Array of 7 dates representing the week
 */
export function getWeekDates(date) {
	const weekStartDay = appConfig.calendar.weekStartDay;
	const startOfWeek = new Date(date);
	const day = startOfWeek.getDay();

	// Calculate difference to get to the configured start of week
	const diff = startOfWeek.getDate() - ((day - weekStartDay + 7) % 7);
	startOfWeek.setDate(diff);

	const weekDates = [];
	for (let i = 0; i < 7; i++) {
		const weekDate = new Date(startOfWeek);
		weekDate.setDate(startOfWeek.getDate() + i);
		weekDates.push(weekDate);
	}
	return weekDates;
}

/**
 * Get array of dates for month view (including padding days)
 * @param {Date} date - Reference date (any day in the month)
 * @returns {Date[]} Array of dates for calendar grid (42 days)
 */
export function getMonthDates(date) {
	const weekStartDay = appConfig.calendar.weekStartDay;
	const year = date.getFullYear();
	const month = date.getMonth();

	// First day of the month
	const firstDay = new Date(year, month, 1);

	// Start from the configured start day of the week containing the first day
	const startDate = new Date(firstDay);
	const firstDayOfWeek = firstDay.getDay();
	const diff = (firstDayOfWeek - weekStartDay + 7) % 7;
	startDate.setDate(firstDay.getDate() - diff);

	// Generate 42 days (6 weeks) for consistent grid
	const monthDates = [];
	for (let i = 0; i < 42; i++) {
		const currentDate = new Date(startDate);
		currentDate.setDate(startDate.getDate() + i);
		monthDates.push(currentDate);
	}

	return monthDates;
}

/**
 * Check if an event falls within a date range using UTC comparisons
 * @param {CalendarEvent} event - Calendar event to check
 * @param {Date} start - Start of date range (should be UTC date)
 * @param {Date} end - End of date range (should be UTC date)
 * @returns {boolean} True if event overlaps with date range
 */
export function isEventInDateRange(event, start, end) {
	if (!event || !event.start) return false;

	// Convert UNIX timestamps to UTC dates for comparison
	// event.start and event.end are now UNIX timestamps (seconds)
	const eventStartDateUTC = new Date(event.start * 1000);
	const eventEndDateUTC = event.end
		? new Date(event.end * 1000)  // Exclusive end date
		: eventStartDateUTC;          // Same day if no end

	// Ensure range dates are also UTC dates
	const startUTC = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
	const endUTC = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

	// Check for overlap: eventStart < rangeEnd AND eventEnd > rangeStart
	// Note: NIP-52 end date is exclusive, so we use > instead of >=
	return eventStartDateUTC < endUTC && eventEndDateUTC > startUTC;
}

/**
 * Group events by date for calendar display
 * @param {CalendarEvent[]} events - Array of calendar events
 * @returns {Map<string, CalendarEvent[]>} Map of date strings to event arrays
 */
export function groupEventsByDate(events) {
	// Defensive check for undefined/null or invalid input
	if (!events || !Array.isArray(events)) {
		console.warn('📅 groupEventsByDate: Invalid events array:', events);
		return new Map();
	}

	const groupedEvents = new Map();

	events.forEach(event => {
		if (!event.start) return;

		// Validate that start is a valid number
		const startTimestamp = typeof event.start === 'number' ? event.start : parseInt(event.start, 10);
		if (isNaN(startTimestamp)) {
			console.warn('📅 groupEventsByDate: Invalid event start timestamp:', event.start, 'for event:', event.title || event.id);
			return;
		}

		// Convert UNIX timestamp to UTC date and create consistent date key
		const eventDate = new Date(startTimestamp * 1000);
		const dateKey = createDateKey(eventDate); // Use consistent UTC-based key generation

		if (!groupedEvents.has(dateKey)) {
			groupedEvents.set(dateKey, []);
		}
		groupedEvents.get(dateKey).push(event);
	});

	// Sort events within each date by start timestamp
	groupedEvents.forEach(dayEvents => {
		dayEvents.sort(
			/** @param {CalendarEvent} a @param {CalendarEvent} b */
			(a, b) => (a.start || 0) - (b.start || 0)
		);
	});

	return groupedEvents;
}

/**
 * Create targeting tags for community-specific events
 * @param {string} communityPubkey - Community public key
 * @returns {string[][]} Array of tag arrays for Nostr event
 */
export function createEventTargetingTags(communityPubkey) {
	return [
		['a', `34550:${communityPubkey}:communikey`], // Target the community
		['k', '34550'], // Reference community kind
		['p', communityPubkey] // Tag community pubkey
	];
}

/**
 * Validate event form data
 * @param {EventFormData} formData - Form data to validate
 * @returns {string[]} Array of validation error messages
 */
export function validateEventForm(formData) {
	const errors = [];

	if (!formData.title?.trim()) {
		errors.push('Event title is required');
	}

	if (!formData.startDate) {
		errors.push('Start date is required');
	}

	if (formData.eventType === 'time' && !formData.startTime) {
		errors.push('Start time is required for time-based events');
	}

	if (formData.endDate && formData.startDate) {
		const startDate = new Date(formData.startDate);
		const endDate = new Date(formData.endDate);
		if (endDate < startDate) {
			errors.push('End date cannot be before start date');
		}
	}

	if (formData.eventType === 'time' && formData.endTime && formData.startTime) {
		const startTime = new Date(`2000-01-01T${formData.startTime}`);
		const endTime = new Date(`2000-01-01T${formData.endTime}`);
		if (endTime <= startTime && formData.startDate === formData.endDate) {
			errors.push('End time must be after start time for same-day events');
		}
	}

	return errors;
}

/**
 * Convert form data to calendar event object
 * @param {EventFormData} formData - Form data to convert
 * @param {string} communityPubkey - Target community public key
 * @returns {Partial<CalendarEvent>} Partial calendar event object
 */
export function convertFormDataToEvent(formData, communityPubkey) {
	/** @type {Partial<CalendarEvent>} */
	const event = {
		title: formData.title.trim(),
		summary: formData.summary?.trim() || '',
		image: formData.image?.trim() || '',
		communityPubkey,
		location: formData.locations.filter(loc => loc.trim()).join(', '),
		hashtags: [],
		references: [],
		participants: []
	};

	// Handle date/time conversion
	if (formData.eventType === 'date' || formData.isAllDay) {
		// Date-based event (kind 31922)
		event.kind = 31922;
		const startDate = new Date(formData.startDate);
		event.start = Math.floor(startDate.getTime() / 1000);

		if (formData.endDate) {
			const endDate = new Date(formData.endDate);
			event.end = Math.floor(endDate.getTime() / 1000);
		}
	} else {
		// Time-based event (kind 31923)
		event.kind = 31923;
		const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
		event.start = Math.floor(startDateTime.getTime() / 1000);

		if (formData.endDate && formData.endTime) {
			const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
			event.end = Math.floor(endDateTime.getTime() / 1000);
		}

		// Add timezone information
		if (formData.startTimezone) {
			event.startTimezone = formData.startTimezone;
		}
		if (formData.endTimezone) {
			event.endTimezone = formData.endTimezone;
		}
	}

	return event;
}

/**
 * Get current user's timezone
 * @returns {string} IANA timezone identifier
 */
export function getCurrentTimezone() {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Check if a date is today
 * @param {Date} date - Date to check
 * @returns {boolean} True if date is today
 */
export function isToday(date) {
	const today = new Date();
	return date.toDateString() === today.toDateString();
}

/**
 * Check if a date is in the current month
 * @param {Date} date - Date to check
 * @param {Date} referenceDate - Reference date for current month
 * @returns {boolean} True if date is in the same month as reference
 */
export function isCurrentMonth(date, referenceDate) {
	return date.getMonth() === referenceDate.getMonth() && 
		   date.getFullYear() === referenceDate.getFullYear();
}

/**
 * Get the next occurrence of a weekday
 * @param {number} weekday - Day of week (0 = Sunday, 6 = Saturday)
 * @param {Date} [fromDate] - Starting date (defaults to today)
 * @returns {Date} Next occurrence of the weekday
 */
export function getNextWeekday(weekday, fromDate = new Date()) {
	const date = new Date(fromDate);
	const currentDay = date.getDay();
	const daysUntilTarget = (weekday - currentDay + 7) % 7;

	if (daysUntilTarget === 0) {
		// If it's the same weekday, get next week's occurrence
		date.setDate(date.getDate() + 7);
	} else {
		date.setDate(date.getDate() + daysUntilTarget);
	}

	return date;
}

/**
 * Create a UTC-based date key for consistent event grouping and lookup
 * @param {Date} date - Local date object
 * @returns {string} UTC date key in YYYY-MM-DD format
 */
export function createDateKey(date) {
	// Validate the date is valid
	if (!date || isNaN(date.getTime())) {
		console.warn('📅 createDateKey: Invalid date passed:', date);
		// Return today's date as fallback
		const today = new Date();
		const utcDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
		return utcDate.toISOString().split('T')[0];
	}

	// Convert local date to UTC date for consistent key generation
	const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	return utcDate.toISOString().split('T')[0];
}

/**
 * Get weekday headers based on the configured week start day
 * @returns {string[]} Array of weekday abbreviations starting from configured day
 */
export function getWeekdayHeaders() {
	const weekStartDay = appConfig.calendar.weekStartDay;
	const fullWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	// Rotate the array to start from the configured day
	const rotatedWeekdays = [
		...fullWeekdays.slice(weekStartDay),
		...fullWeekdays.slice(0, weekStartDay)
	];

	return rotatedWeekdays;
}
