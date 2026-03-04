<script>
  import Icon from '../Icon.svelte';

  export let class_ = 'w-5 h-5';
  export let title = 'Kanban Board';
</script>

<Icon {class_} {title}>
  <rect x="3" y="3" width="5" height="18" rx="1" />
  <rect x="10" y="3" width="5" height="12" rx="1" />
  <rect x="17" y="3" width="5" height="15" rx="1" />
</Icon>
