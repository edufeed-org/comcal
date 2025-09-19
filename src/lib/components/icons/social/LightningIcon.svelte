<script>
  import Icon from '../Icon.svelte';
  
  export let class_ = 'w-5 h-5';
  export let title = 'Lightning';
  export let fill = 'currentColor';
</script>

<Icon {class_} {title} {fill} stroke="none">
  <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
</Icon>
