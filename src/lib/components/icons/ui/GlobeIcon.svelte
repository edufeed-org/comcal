<!--
  GlobeIcon Component
  Globe/world icon for global/public content
-->

<script>
	import Icon from '../Icon.svelte';

	export let class_ = 'w-5 h-5';
	export let title = 'Globe';
</script>

<Icon {class_} {title}>
	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
</Icon>
