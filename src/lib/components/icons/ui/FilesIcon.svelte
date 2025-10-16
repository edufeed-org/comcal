<script>
	import Icon from '../Icon.svelte';
	
	export let class_ = 'w-5 h-5';
	export let title = 'Files';
</script>

<Icon {class_} {title}>
	<path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
</Icon>
