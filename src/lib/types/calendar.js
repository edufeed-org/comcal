/**
 * Calendar and Event Management Type Definitions
 * Using JSDoc for type safety in JavaScript
 * Based on NIP-52 Calendar Events and Communikey Specification
 */

/**
 * @typedef {31922 | 31923} CalendarEventKind
 * NIP-52 event kinds: 31922 for date-based, 31923 for time-based
 */

/**
 * @typedef {Object} CalendarEventParticipant
 * @property {string} pubkey - Public key of participant
 * @property {string} [relay] - Optional relay URL
 * @property {string} [role] - Optional role description
 */

/**
 * @typedef {Object} CalendarEventRSVP
 * @property {string} id - RSVP event ID
 * @property {string} pubkey - RSVP creator's public key
 * @property {number} created_at - RSVP creation timestamp
 * @property {string} [content] - Optional RSVP message
 */

/**
 * @typedef {Object} CalendarEvent
 * @property {string} id - Unique event identifier
 * @property {string} pubkey - Creator's public key
 * @property {CalendarEventKind} kind - Event kind (31922 or 31923)
 * @property {string} title - Event title
 * @property {string} [summary] - Optional event description
 * @property {string} [image] - Optional event image URL
 * @property {number} start - Start time as Unix timestamp (seconds) - ALWAYS UNIX TIMESTAMP
 * @property {number} [end] - Optional end time as Unix timestamp (seconds) - ALWAYS UNIX TIMESTAMP
 * @property {string} [startTimezone] - Start timezone (IANA format)
 * @property {string} [endTimezone] - End timezone (IANA format)
 * @property {string} location - Array of location strings
 * @property {CalendarEventParticipant[]} participants - Event participants
 * @property {string[]} hashtags - Event hashtags
 * @property {string[]} references - Referenced event IDs
 * @property {string[]} eventReferences - Referenced calendar event IDs
 * @property {string} [geohash] - Optional geohash for location
 * @property {string} communityPubkey - Target community public key
 * @property {number} createdAt - Creation timestamp (Unix timestamp)
 * @property {string} [dTag] - Optional d-tag identifier for NIP-52 events
 * @property {any} [originalEvent] - Optional original applesauce event for model operations
 * @property {CalendarEventRSVP[]} [rsvps] - Optional RSVP events for this calendar event
 * @property {number} [rsvpCount] - Optional count of RSVPs
 */

/**
 * @typedef {'week' | 'month' | 'day'} CalendarViewMode
 */

/**
 * @typedef {'date' | 'time'} EventType
 */

/**
 * @typedef {Object} CalendarViewState
 * @property {Date} currentDate - Currently displayed date
 * @property {CalendarViewMode} viewMode - Current view mode
 * @property {CalendarEvent} [selectedEvent] - Currently selected event
 * @property {boolean} isCreating - Whether user is creating an event
 * @property {EventType} eventType - Type of event being created
 */

/**
 * @typedef {Object} EventFormData
 * @property {string} title - Event title
 * @property {string} summary - Event description
 * @property {string} image - Event image URL
 * @property {string} startDate - Start date (YYYY-MM-DD)
 * @property {string} startTime - Start time (HH:MM)
 * @property {string} endDate - End date (YYYY-MM-DD)
 * @property {string} endTime - End time (HH:MM)
 * @property {string} startTimezone - Start timezone
 * @property {string} endTimezone - End timezone
 * @property {string[]} locations - Event locations
 * @property {boolean} isAllDay - Whether event is all day
 * @property {EventType} eventType - Event type (date or time)
 */

/**
 * @typedef {Object} CalendarStore
 * @property {CalendarEvent[]} events - Array of calendar events
 * @property {CalendarViewState} viewState - Current view state
 * @property {boolean} loading - Loading state
 * @property {string | null} error - Error message if any
 * @property {CalendarEvent[]} currentMonthEvents - Events for current month
 * @property {CalendarEvent[]} currentWeekEvents - Events for current week
 * @property {CalendarEvent[]} currentDayEvents - Events for current day
 * @property {Map<string, CalendarEvent[]>} groupedEvents - Events grouped by date
 * @property {function(): CalendarEvent[]} getCurrentViewEvents - Get events for current view
 * @property {function(string): void} setViewMode - Set view mode
 * @property {function(Date): void} setCurrentDate - Set current date
 * @property {function(Date): void} navigateToDate - Navigate to specific date
 * @property {function(): void} navigateNext - Navigate to next period
 * @property {function(): void} navigatePrevious - Navigate to previous period
 * @property {function(): void} navigateToToday - Navigate to today
 * @property {function(CalendarEvent): void} selectEvent - Select an event
 * @property {function(): void} clearSelection - Clear event selection
 * @property {function(string): void} startCreating - Start creating event
 * @property {function(): void} stopCreating - Stop creating event
 * @property {function(string): void} setEventType - Set event type
 * @property {function(): void} refresh - Refresh events
 * @property {function(): void} destroy - Cleanup store
 */

/**
 * @typedef {Object} CalendarActions
 * @property {function(EventFormData, string): Promise<void>} createEvent - Create new event
 * @property {function(string, Partial<CalendarEvent>): Promise<void>} updateEvent - Update event
 * @property {function(string): Promise<void>} deleteEvent - Delete event
 * @property {function(string, string): Promise<void>} createTargetedPublication - Create targeted publication
 * @property {function(string, string=): Promise<string>} createCalendar - Create new calendar
 * @property {function(string): Promise<CalendarEvent[]>} loadEvents - Load community events
 */

// Export empty object to make this a module
export { };
