/**
 * Calendar Helper Functions
 * Utilities for date formatting, event management, and calendar operations
 */

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
	const startOfWeek = new Date(date);
	const day = startOfWeek.getDay();
	const diff = startOfWeek.getDate() - day; // Sunday as start of week
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
	const year = date.getFullYear();
	const month = date.getMonth();

	// First day of the month
	const firstDay = new Date(year, month, 1);
	const lastDay = new Date(year, month + 1, 0);

	// Start from Sunday of the week containing the first day
	const startDate = new Date(firstDay);
	startDate.setDate(firstDay.getDate() - firstDay.getDay());

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
 * Check if an event falls within a date range
 * @param {CalendarEvent} event - Calendar event to check
 * @param {Date} start - Start of date range
 * @param {Date} end - End of date range
 * @returns {boolean} True if event overlaps with date range
 */
export function isEventInDateRange(event, start, end) {
	if (!event || !event.start) return false;

	const eventStart = new Date(event.start * 1000); // Convert from Unix timestamp
	const eventEnd = event.end ? new Date(event.end * 1000) : eventStart;

	// Check for any overlap between event and date range
	return eventStart <= end && eventEnd >= start;
}

/**
 * Group events by date for calendar display
 * @param {CalendarEvent[]} events - Array of calendar events
 * @returns {Map<string, CalendarEvent[]>} Map of date strings to event arrays
 */
export function groupEventsByDate(events) {
	const groupedEvents = new Map();

	events.forEach(event => {
		if (!event.start) return;

		const eventDate = new Date(event.start * 1000);
		const dateKey = formatCalendarDate(eventDate, 'YYYY-MM-DD');

		if (!groupedEvents.has(dateKey)) {
			groupedEvents.set(dateKey, []);
		}
		groupedEvents.get(dateKey).push(event);
	});

	// Sort events within each date by start time
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
		locations: formData.locations.filter(loc => loc.trim()),
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
