/**
 * CalDAV autodiscovery endpoint
 * 
 * Calendar clients like Thunderbird make PROPFIND requests to /.well-known/caldav
 * as part of the CalDAV autodiscovery protocol (RFC 6764). This endpoint handles
 * those requests to prevent 404 errors, while indicating that we only support
 * ICS calendar subscriptions, not full CalDAV.
 */

/** @type {import('./$types').RequestHandler} */
export async function GET() {
	return new Response(
		'This server provides ICS calendar feeds but does not support CalDAV protocol. Please use the webcal:// URL for calendar subscription.',
		{
			status: 200,
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'DAV': '1', // Minimal DAV header
			}
		}
	);
}

/** @type {import('./$types').RequestHandler} */
export async function PROPFIND() {
	// Return 404 with proper CalDAV headers to indicate no CalDAV support
	return new Response(
		'<?xml version="1.0" encoding="utf-8"?><error xmlns="DAV:">CalDAV not supported. Use ICS feed instead.</error>',
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
