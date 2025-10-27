/**
 * CardDAV autodiscovery endpoint
 * 
 * Some calendar clients also check for CardDAV support alongside CalDAV.
 * This endpoint handles those requests to prevent 404 errors, indicating
 * that we don't support CardDAV.
 */

/** @type {import('./$types').RequestHandler} */
export async function GET() {
	return new Response(
		'This server does not support CardDAV protocol.',
		{
			status: 200,
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'DAV': '1',
			}
		}
	);
}

/** @type {import('./$types').RequestHandler} */
export async function OPTIONS() {
	return new Response(null, {
		status: 204,
		headers: {
			'Allow': 'GET, OPTIONS',
			'DAV': '1',
		}
	});
}
