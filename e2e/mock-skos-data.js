/**
 * Mock SKOS vocabulary data for E2E tests.
 *
 * These mocks are used with Playwright's page.route() to intercept
 * requests to w3id.org SKOS endpoints, enabling full AMB creation
 * flow testing without external dependencies.
 *
 * Structure matches what skosLoader.js expects:
 * - hasTopConcept array at top level
 * - Each concept has: id, prefLabel (language-keyed object)
 * - Optional: notation, narrower (for hierarchy)
 */

/**
 * Learning Resource Type vocabulary (HCRT)
 * URL: https://w3id.org/kim/hcrt/scheme.json
 */
export const MOCK_HCRT_VOCABULARY = {
  id: 'https://w3id.org/kim/hcrt/scheme',
  type: 'ConceptScheme',
  title: {
    de: 'Hochschulcampus Ressourcentypen',
    en: 'Higher Education Resource Types'
  },
  hasTopConcept: [
    {
      id: 'https://w3id.org/kim/hcrt/text',
      prefLabel: { de: 'Text', en: 'Text' }
    },
    {
      id: 'https://w3id.org/kim/hcrt/video',
      prefLabel: { de: 'Video', en: 'Video' }
    },
    {
      id: 'https://w3id.org/kim/hcrt/audio',
      prefLabel: { de: 'Audio', en: 'Audio' }
    },
    {
      id: 'https://w3id.org/kim/hcrt/image',
      prefLabel: { de: 'Abbildung', en: 'Image' }
    },
    {
      id: 'https://w3id.org/kim/hcrt/web_page',
      prefLabel: { de: 'Webseite', en: 'Web Page' }
    },
    {
      id: 'https://w3id.org/kim/hcrt/application',
      prefLabel: { de: 'Softwareanwendung', en: 'Application' }
    }
  ]
};

/**
 * Subject/Topic vocabulary (Hochschulfaechersystematik)
 * URL: https://w3id.org/kim/hochschulfaechersystematik/scheme.json
 */
export const MOCK_SUBJECTS_VOCABULARY = {
  id: 'https://w3id.org/kim/hochschulfaechersystematik/scheme',
  type: 'ConceptScheme',
  title: {
    de: 'Destatis-Systematik der Fächergruppen',
    en: 'Subject Classification'
  },
  hasTopConcept: [
    {
      id: 'https://w3id.org/kim/hochschulfaechersystematik/n0',
      notation: ['0'],
      prefLabel: { de: 'Fachübergreifend', en: 'Interdisciplinary' }
    },
    {
      id: 'https://w3id.org/kim/hochschulfaechersystematik/n1',
      notation: ['1'],
      prefLabel: { de: 'Geisteswissenschaften', en: 'Humanities' },
      narrower: [
        {
          id: 'https://w3id.org/kim/hochschulfaechersystematik/n11',
          notation: ['11'],
          prefLabel: { de: 'Philosophie', en: 'Philosophy' }
        },
        {
          id: 'https://w3id.org/kim/hochschulfaechersystematik/n12',
          notation: ['12'],
          prefLabel: { de: 'Geschichte', en: 'History' }
        }
      ]
    },
    {
      id: 'https://w3id.org/kim/hochschulfaechersystematik/n4',
      notation: ['4'],
      prefLabel: { de: 'Mathematik, Naturwissenschaften', en: 'Mathematics, Natural Sciences' },
      narrower: [
        {
          id: 'https://w3id.org/kim/hochschulfaechersystematik/n41',
          notation: ['41'],
          prefLabel: { de: 'Mathematik', en: 'Mathematics' }
        },
        {
          id: 'https://w3id.org/kim/hochschulfaechersystematik/n44',
          notation: ['44'],
          prefLabel: { de: 'Informatik', en: 'Computer Science' }
        },
        {
          id: 'https://w3id.org/kim/hochschulfaechersystematik/n45',
          notation: ['45'],
          prefLabel: { de: 'Physik, Astronomie', en: 'Physics, Astronomy' }
        }
      ]
    },
    {
      id: 'https://w3id.org/kim/hochschulfaechersystematik/n7',
      notation: ['7'],
      prefLabel: { de: 'Kunst, Kunstwissenschaft', en: 'Art, Art Studies' }
    }
  ]
};

/**
 * Intended End User Role vocabulary (optional, not always used)
 * URL: https://w3id.org/kim/intendedEndUserRole/scheme.json
 */
export const MOCK_END_USER_ROLE_VOCABULARY = {
  id: 'https://w3id.org/kim/intendedEndUserRole/scheme',
  type: 'ConceptScheme',
  title: {
    de: 'Zielgruppen',
    en: 'Intended End User Roles'
  },
  hasTopConcept: [
    {
      id: 'https://w3id.org/kim/intendedEndUserRole/learner',
      prefLabel: { de: 'Lernende', en: 'Learner' }
    },
    {
      id: 'https://w3id.org/kim/intendedEndUserRole/teacher',
      prefLabel: { de: 'Lehrende', en: 'Teacher' }
    }
  ]
};
