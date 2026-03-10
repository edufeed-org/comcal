/**
 * App-wide ActionRunner singleton.
 * Orchestrates applesauce actions with EventStore, EventFactory, and publishing.
 *
 * Usage:
 *   import { actionRunner } from '$lib/stores/action-runner.svelte.js';
 *   import { AddEventToCalendar } from 'applesauce-actions/actions';
 *   await actionRunner.run(AddEventToCalendar, calendarEvent, eventToAdd);
 */

import { ActionRunner } from 'applesauce-actions';
import { EventFactory } from 'applesauce-core/event-factory';
import { eventStore } from './nostr-infrastructure.svelte';
import { manager } from './accounts.svelte';
import { publishEvent } from '$lib/services/publish-service.js';

const factory = new EventFactory({ signer: manager.signer });

/**
 * Publish wrapper adapting our publishEvent to applesauce's PublishMethod signature.
 * @param {import('nostr-tools').NostrEvent} event
 * @param {string[]} [relays]
 */
const publish = async (event, relays) => {
  const result = await publishEvent(event, [], { additionalRelays: relays || [] });
  if (!result.success) throw new Error('Failed to publish event to any relay');
};

export const actionRunner = new ActionRunner(eventStore, factory, publish);
