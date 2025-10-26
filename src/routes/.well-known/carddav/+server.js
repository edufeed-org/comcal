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
export async function PROPFIND() {
	// Return 404 with proper DAV headers to indicate no CardDAV support
	return new Response(
		'<?xml version="1.0" encoding="utf-8"?><error xmlns="DAV:">CardDAV not supported.</error>',
		{
			status: 404,
			headers: {
				'Content-Type': 'application/xml; charset=utf-8',
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
			'Allow': 'GET, PROPFIND, OPTIONS',
			'DAV': '1',
		}
	});
}
