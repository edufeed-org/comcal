/**
 * SKOSDropdown Component Tests
 *
 * Tests the SKOS vocabulary dropdown trigger styling to ensure
 * it visually matches native select elements.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import SKOSDropdown from '../educational/SKOSDropdown.svelte';

// Mock paraglide runtime
vi.mock('$lib/paraglide/runtime.js', () => ({
	getLocale: () => 'en'
}));

// Mock SKOS loader
vi.mock('$lib/helpers/educational/skosLoader.js', () => ({
	fetchVocabulary: vi.fn().mockResolvedValue([
		{ id: 'https://example.com/text', prefLabel: { en: 'Text' }, level: 0 }
	]),
	getConceptLabel: (concept, locale) => concept.prefLabel?.[locale] || concept.id,
	sortConceptsByLabel: (concepts) => concepts,
	filterConcepts: (concepts) => concepts
}));

describe('SKOSDropdown', () => {
	it('renders trigger button with select-trigger class for consistent styling', () => {
		const { container } = render(SKOSDropdown, {
			props: {
				vocabularyKey: 'learningResourceType',
				label: 'Resource Type',
				placeholder: 'Select type...'
			}
		});

		const trigger = container.querySelector('button[role="button"]');
		expect(trigger).toBeTruthy();
		// Should use select + select-bordered + select-trigger to match native selects
		expect(trigger.classList.contains('select')).toBe(true);
		expect(trigger.classList.contains('select-bordered')).toBe(true);
		expect(trigger.classList.contains('select-trigger')).toBe(true);
	});
});
