<script>
	import { onMount } from 'svelte';
	import { encodeEventToNaddr } from '$lib/helpers/nostrUtils';
	import { showToast } from '$lib/helpers/toast.js';
	import { CalendarIcon } from '../icons';
	import { calendarStore } from '$lib/stores/calendar-events.svelte.js';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import DownloadIcon from '../icons/actions/DownloadIcon.svelte';

	// Props for explicit calendar ID (for community calendars)
	let { calendarId = null, calendarTitle = null } = $props();

	let selectedCalendar = $state(calendarStore.selectedCalendar);
	let calendarSubscription = $state();

	onMount(() => {
		calendarSubscription = calendarStore.selectedCalendar$.subscribe((cal) => {
			selectedCalendar = cal;
		});

		return () => {
			calendarSubscription?.unsubscribe();
		};
	});

	// Get calendar ID (from prop or selectedCalendar)
	const getCalendarId = () => {
		if (calendarId) return calendarId;
		if (selectedCalendar?.originalEvent) {
			return encodeEventToNaddr(selectedCalendar.originalEvent);
		}
		return selectedCalendar?.id || '';
	};

	// Get calendar title (from prop or selectedCalendar)
	const getCalendarTitle = () => {
		if (calendarTitle) return calendarTitle;
		return selectedCalendar?.title || 'Calendar';
	};

	// Generate webcal URL for calendar subscription
	const generateWebcalUrl = () => {
		const baseUrl = window.location.origin;
		const id = getCalendarId();
		return `webcal://${baseUrl.replace(/^https?:\/\//, '')}/api/calendar/${id}/ics`;
	};

	// Generate ICS download URL
	const generateIcsUrl = () => {
		const baseUrl = window.location.origin;
		const id = getCalendarId();
		return `${baseUrl}/api/calendar/${id}/ics`;
	};

	const handleCopyWebcalLink = async () => {
		try {
			const webcalUrl = generateWebcalUrl();
			await navigator.clipboard.writeText(webcalUrl);
			showToast('calendar.link.copied', 'success');
		} catch (error) {
			console.error('Error copying webcal link:', error);
			showToast('calendar.link.error', 'error');
		}
	};

	const handleSubscribeToCalendar = () => {
		try {
			const webcalUrl = generateWebcalUrl();
			window.open(webcalUrl, '_blank');
			showToast('calendar subscription added', 'success');
		} catch (error) {
			console.error('Error opening webcal link:', error);
			showToast('calendar link error', 'error');
		}
	};

	const handleDownloadIcs = () => {
		try {
			const icsUrl = generateIcsUrl();
			const link = document.createElement('a');
			link.href = icsUrl;
			link.download = `${selectedCalendar?.title || 'calendar'}.ics`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			showToast('calendar download success', 'success');
		} catch (error) {
			console.error('Error downloading ICS:', error);
			showToast('calendar link error', 'error');
		}
	};

	const handleShowQRCode = () => {
		try {
			const webcalUrl = generateWebcalUrl();
			const calendarTitle = selectedCalendar?.title || 'Calendar';
			modalStore.openModal('webcalQRCode', { webcalUrl, calendarTitle });
		} catch (error) {
			console.error('Error opening QR code modal:', error);
			showToast('Failed to open QR code', 'error');
		}
	};

	const actions = [
		{
			icon: '📅',
			name: 'Subscribe to Calendar',
			tooltip: 'Auto-updates with new events',
			onClick: handleSubscribeToCalendar
		},
		{
			icon: '⬇️',
			name: 'Download Calendar',
			tooltip: 'One-time ics download',
			onClick: handleDownloadIcs
		},
		{
			icon: '🔗',
			name: 'Copy Webcal Link',
			tooltip: 'Copy subscription link',
			onClick: handleCopyWebcalLink
		},
		{
			icon: '📱',
			name: 'Show QR Code',
			tooltip: 'Scan with mobile to subscribe',
			onClick: handleShowQRCode
		}
	];
</script>

<div class="z-10">
	<div class="dropdown dropdown-end dropdown-bottom">
		<div tabindex="0" role="button" class="btn btn-circle btn-primary">
			<DownloadIcon class_="w-4 h-4" />
		</div>
		<ul class="dropdown-content menu z-[1] mb-2 rounded-box p-2 shadow">
			{#each actions as action}
				<li>
					<button class="btn btn-circle btn-lg" onclick={action.onClick} title={action.tooltip}>
						<span class="text-lg">{action.icon}</span>
					</button>
				</li>
			{/each}
		</ul>
	</div>
</div>
