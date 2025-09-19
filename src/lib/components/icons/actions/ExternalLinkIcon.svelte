<script>
  import Icon from '../Icon.svelte';
  
  export let class_ = 'w-5 h-5';
  export let title = 'External Link';
</script>

<Icon {class_} {title}>
  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
</Icon>
