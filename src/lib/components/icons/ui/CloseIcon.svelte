<script>
  import Icon from '../Icon.svelte';

  export let class_ = 'w-5 h-5';
  export let title = 'Close';
</script>

<Icon {class_} {title}>
  <path d="M6 18L18 6M6 6l12 12" />
</Icon>
