import { getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { npubEncode, naddrEncode } from 'nostr-tools/nip19';

const AUTHOR_COUNT = 4;
const COMMUNITY_COUNT = 30;

/**
 * Create a deterministic private key from a seed string.
 * Uses a simple hash-like approach so keys are identical across processes.
 * @param {number} index
 * @param {string} prefix
 * @returns {Uint8Array}
 */
function deterministicKey(index, prefix) {
	const sk = new Uint8Array(32);
	// Fill with a deterministic pattern based on prefix and index
	const seed = `${prefix}-${index}`;
	for (let i = 0; i < 32; i++) {
		sk[i] = (seed.charCodeAt(i % seed.length) + i * 7 + index * 13) & 0xff;
	}
	// Ensure valid secp256k1 scalar (must be < curve order, non-zero)
	// Setting first byte to reasonable range avoids exceeding curve order
	sk[0] = (sk[0] % 127) + 1;
	return sk;
}

// Deterministic keypairs (same across processes)
const contentAuthors = Array.from({ length: AUTHOR_COUNT }, (_, i) => {
	const sk = deterministicKey(i, 'content');
	return { sk, pk: getPublicKey(sk) };
});

const communityAuthors = Array.from({ length: COMMUNITY_COUNT }, (_, i) => {
	const sk = deterministicKey(i, 'community');
	return { sk, pk: getPublicKey(sk) };
});

const NOW = Math.floor(Date.now() / 1000);
const BASE = NOW - 30 * 24 * 3600; // 30 days ago

const adjectives = [
	'Introduction to',
	'Advanced',
	'Fundamentals of',
	'Guide to',
	'Exploring',
	'Practical',
	'Modern',
	'Essential',
	'Beginner',
	'Deep Dive into'
];
const subjects = [
	'Mathematics',
	'Physics',
	'History',
	'Programming',
	'Biology',
	'Chemistry',
	'Literature',
	'Economics',
	'Psychology',
	'Art'
];

/**
 * Create a signed Nostr event
 * @param {{sk: Uint8Array, pk: string}} author
 * @param {number} kind
 * @param {string[][]} tags
 * @param {string} content
 * @param {number} createdAt
 * @returns {object}
 */
function make(author, kind, tags, content, createdAt) {
	return finalizeEvent(
		{
			kind,
			tags,
			content: content || '',
			created_at: createdAt
		},
		author.sk
	);
}

/**
 * Generate all test events for the mock relay.
 * @returns {object[]}
 */
export function generateTestEvents() {
	const events = [];

	// 50 kind 30023 articles
	for (let i = 0; i < 50; i++) {
		const a = contentAuthors[i % AUTHOR_COUNT];
		const title = `${adjectives[i % adjectives.length]} ${subjects[i % subjects.length]} #${i}`;
		events.push(
			make(
				a,
				30023,
				[
					['d', `article-${i}`],
					['title', title],
					['summary', `Summary of ${title}`],
					['published_at', String(BASE + i * 600)],
					['t', subjects[i % subjects.length].toLowerCase()],
					['t', 'test']
				],
				`# ${title}\n\nContent for article ${i}.`,
				BASE + i * 600
			)
		);
	}

	// 50 kind 30142 AMB educational resources
	for (let i = 0; i < 50; i++) {
		const a = contentAuthors[i % AUTHOR_COUNT];
		const name = `Resource: ${subjects[i % subjects.length]} ${adjectives[i % adjectives.length]} #${i}`;
		events.push(
			make(
				a,
				30142,
				[
					['d', `https://example.com/resource-${i}`],
					['name', name],
					['description', `Educational resource about ${subjects[i % subjects.length]}`],
					['learningResourceType.id', 'https://w3id.org/kim/hcrt/text'],
					['learningResourceType.prefLabel.de', 'Text'],
					['learningResourceType.prefLabel.en', 'Text'],
					['about.id', 'https://w3id.org/kim/hochschulfaechersystematik/n01'],
					['about.prefLabel.de', 'Informatik'],
					['about.prefLabel.en', 'Computer Science'],
					['inLanguage', 'en'],
					['license.id', 'https://creativecommons.org/licenses/by/4.0/'],
					['license.prefLabel.en', 'CC BY 4.0'],
					['keywords', subjects[i % subjects.length].toLowerCase()],
					['datePublished', String(BASE + (50 + i) * 600)]
				],
				'',
				BASE + (50 + i) * 600
			)
		);
	}

	// 25 kind 31922 date-based calendar events
	for (let i = 0; i < 25; i++) {
		const a = contentAuthors[i % AUTHOR_COUNT];
		const startTs = NOW + (i + 1) * 86400; // future dates
		events.push(
			make(
				a,
				31922,
				[
					['d', `date-event-${i}`],
					['title', `Date Event: ${subjects[i % subjects.length]} Workshop #${i}`],
					['start', String(startTs)],
					['t', 'workshop']
				],
				`Workshop about ${subjects[i % subjects.length]}`,
				BASE + (100 + i) * 600
			)
		);
	}

	// 25 kind 31923 time-based calendar events
	for (let i = 0; i < 25; i++) {
		const a = contentAuthors[i % AUTHOR_COUNT];
		const startTs = NOW + (i + 30) * 86400;
		const endTs = startTs + 7200;
		events.push(
			make(
				a,
				31923,
				[
					['d', `time-event-${i}`],
					['title', `Time Event: ${subjects[i % subjects.length]} Lecture #${i}`],
					['start', String(startTs)],
					['end', String(endTs)],
					['t', 'lecture']
				],
				'',
				BASE + (125 + i) * 600
			)
		);
	}

	// 30 kind 10222 community definitions (one per unique keypair)
	for (let i = 0; i < COMMUNITY_COUNT; i++) {
		const a = communityAuthors[i];
		events.push(
			make(
				a,
				10222,
				[
					['d', ''],
					['name', `Test Community ${i}: ${subjects[i % subjects.length]}`],
					['about', `A community about ${subjects[i % subjects.length]}`]
				],
				JSON.stringify({
					name: `Test Community ${i}: ${subjects[i % subjects.length]}`,
					about: `A community about ${subjects[i % subjects.length]}`
				}),
				BASE + (150 + i) * 600
			)
		);
	}

	// Kind 0 profiles for content authors
	for (let i = 0; i < AUTHOR_COUNT; i++) {
		events.push(
			make(
				contentAuthors[i],
				0,
				[],
				JSON.stringify({
					name: `Test Author ${i}`,
					about: `Bio for test author ${i}`,
					picture: `https://robohash.org/${contentAuthors[i].pk}`
				}),
				BASE + (200 + i) * 600
			)
		);
	}

	// 5 community-tagged AMB resources (kind 30142 with #h tag for community 0)
	for (let i = 0; i < 5; i++) {
		const a = contentAuthors[i % AUTHOR_COUNT];
		const name = `Community Resource: ${subjects[i % subjects.length]} #${i}`;
		events.push(
			make(
				a,
				30142,
				[
					['d', `community-resource-${i}`],
					['name', name],
					['description', `Community educational resource about ${subjects[i % subjects.length]}`],
					['h', communityAuthors[0].pk],
					['learningResourceType.id', 'https://w3id.org/kim/hcrt/text'],
					['learningResourceType.prefLabel.de', 'Text'],
					['learningResourceType.prefLabel.en', 'Text'],
					['about.id', 'https://w3id.org/kim/hochschulfaechersystematik/n01'],
					['about.prefLabel.de', 'Informatik'],
					['about.prefLabel.en', 'Computer Science'],
					['inLanguage', 'en'],
					['license.id', 'https://creativecommons.org/licenses/by/4.0/'],
					['license.prefLabel.en', 'CC BY 4.0'],
					['keywords', subjects[i % subjects.length].toLowerCase()],
					['datePublished', String(BASE + (180 + i) * 600)]
				],
				'',
				BASE + (180 + i) * 600
			)
		);
	}

	// 5 community chat messages (kind 9 with #h tag for community 0)
	for (let i = 0; i < 5; i++) {
		const a = contentAuthors[i % AUTHOR_COUNT];
		events.push(
			make(
				a,
				9,
				[['h', communityAuthors[0].pk]],
				`Hello from Test Author ${i % AUTHOR_COUNT}! Message #${i}`,
				BASE + (190 + i) * 600
			)
		);
	}

	// Kind 1 text notes for content authors (5 per author)
	for (let i = 0; i < AUTHOR_COUNT; i++) {
		for (let j = 0; j < 5; j++) {
			const noteIndex = i * 5 + j;
			events.push(
				make(
					contentAuthors[i],
					1,
					[],
					`Test note ${j} from Author ${i}: Discussing ${subjects[noteIndex % subjects.length]}`,
					BASE + (195 + noteIndex) * 600
				)
			);
		}
	}

	// Kind 0 profiles for community authors
	for (let i = 0; i < COMMUNITY_COUNT; i++) {
		events.push(
			make(
				communityAuthors[i],
				0,
				[],
				JSON.stringify({
					name: `Community Host ${i}`,
					picture: `https://robohash.org/${communityAuthors[i].pk}`
				}),
				BASE + (210 + i) * 600
			)
		);
	}

	return events;
}

/** First test community info for community page E2E tests */
export const TEST_COMMUNITY = {
	pubkey: communityAuthors[0].pk,
	npub: npubEncode(communityAuthors[0].pk)
};

/** First test author info for profile page E2E tests */
export const TEST_AUTHOR = {
	pubkey: contentAuthors[0].pk,
	npub: npubEncode(contentAuthors[0].pk),
	name: 'Test Author 0'
};

/** Pre-encoded naddr strings for event detail page E2E tests.
 * Include relay hint so addressLoader knows where to fetch from. */
const RELAY_URL = 'ws://localhost:9737';

export const TEST_NADDRS = {
	article: naddrEncode({
		kind: 30023,
		pubkey: contentAuthors[0].pk,
		identifier: 'article-0',
		relays: [RELAY_URL]
	}),
	calendarDate: naddrEncode({
		kind: 31922,
		pubkey: contentAuthors[0].pk,
		identifier: 'date-event-0',
		relays: [RELAY_URL]
	}),
	calendarTime: naddrEncode({
		kind: 31923,
		pubkey: contentAuthors[0].pk,
		identifier: 'time-event-0',
		relays: [RELAY_URL]
	}),
	amb: naddrEncode({
		kind: 30142,
		pubkey: contentAuthors[0].pk,
		identifier: 'https://example.com/resource-0',
		relays: [RELAY_URL]
	})
};

/** Event counts for test assertions */
export const TEST_COUNTS = {
	articles: 50,
	amb: 50,
	calendarDate: 25,
	calendarTime: 25,
	calendarTotal: 50,
	communities: 30,
	communityAMB: 5,
	communityChat: 5,
	notesPerAuthor: 5
};
