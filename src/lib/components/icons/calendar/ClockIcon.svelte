<script>
  import Icon from '../Icon.svelte';
  
  export let class_ = 'w-5 h-5';
  export let title = 'Clock';
</script>

<Icon {class_} {title}>
  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
</Icon>
