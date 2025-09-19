<script>
  import Icon from '../Icon.svelte';
  
  export let class_ = 'w-5 h-5';
  export let title = 'Bookmark';
</script>

<Icon {class_} {title}>
  <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
</Icon>
