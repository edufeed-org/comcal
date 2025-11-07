import { paraglideMiddleware } from '$lib/paraglide/server';

/** @type {import('@sveltejs/kit').Handle} */
export const handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%lang%', locale)
		});
	});
