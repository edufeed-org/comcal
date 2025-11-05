<script>
	/**
	 * RsvpStatusBadge Component
	 * Displays RSVP status with appropriate styling
	 */

	/**
	 * @type {{ status: 'accepted' | 'declined' | 'tentative', size?: 'sm' | 'md' | 'lg' }}
	 */
	let { status, size = 'md' } = $props();

	const statusConfig = {
		accepted: {
			label: 'Going',
			icon: '✓',
			class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
		},
		declined: {
			label: 'Not Going',
			icon: '✗',
			class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
		},
		tentative: {
			label: 'Maybe',
			icon: '?',
			class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
		}
	};

	const sizeClasses = {
		sm: 'px-2 py-0.5 text-xs',
		md: 'px-2.5 py-1 text-sm',
		lg: 'px-3 py-1.5 text-base'
	};

	const config = $derived(statusConfig[status] || statusConfig.tentative);
	const sizeClass = $derived(sizeClasses[size]);
</script>

<span
	class="inline-flex items-center gap-1 font-medium rounded-full {config.class} {sizeClass}"
	role="status"
	aria-label="RSVP status: {config.label}"
>
	<span class="font-bold" aria-hidden="true">{config.icon}</span>
	<span>{config.label}</span>
</span>
