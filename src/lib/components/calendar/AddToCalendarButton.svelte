<script>
	import { onMount } from 'svelte';
	import { getCalendarEventMetadata } from '$lib/helpers/eventUtils';
	import { encodeEventToNaddr } from '$lib/helpers/nostrUtils';
	import { showToast } from '$lib/helpers/toast.js';
	import { CalendarIcon } from '../icons';
	import { calendarStore } from '$lib/stores/calendar-events.svelte.js';

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

	// Generate webcal URL for calendar subscription
	const generateWebcalUrl = () => {
		const baseUrl = window.location.origin;
		const calendarNaddr = encodeEventToNaddr(selectedCalendar.originalEvent);
		return `webcal://${baseUrl.replace(/^https?:\/\//, '')}/api/calendar/${calendarNaddr}/ics`;
	};

	// Generate ICS download URL
	const generateIcsUrl = () => {
		const baseUrl = window.location.origin;
		const calendarId = selectedCalendar.id;
		return `${baseUrl}/api/calendar/${calendarId}/ics`;
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
			link.download = `${getCalendarEventMetadata(selectedCalendar).title || 'calendar'}.ics`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			showToast('calendar download success', 'success');
		} catch (error) {
			console.error('Error downloading ICS:', error);
			showToast('calendar link error', 'error');
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
		}
	];
</script>

<div class="z-10">
	<div class="dropdown dropdown-end dropdown-bottom">
		<div tabindex="0" role="button" class="btn btn-circle btn-primary">
			<CalendarIcon class_="w-4 h-4" />
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
