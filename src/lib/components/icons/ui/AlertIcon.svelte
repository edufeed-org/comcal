<!--
  AlertIcon Component
  Alert/warning icon for error states and notifications
-->

<script>
	import Icon from '../Icon.svelte';

	export let class_ = 'w-5 h-5';
	export let title = 'Alert';
</script>

<Icon {class_} {title}>
	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
</Icon>
