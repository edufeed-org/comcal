<script>
	import { modalStore } from '$lib/stores/modal.svelte.js';
	
	let { class: className = '' } = $props();
</script>

<button 
	class="btn btn-secondary {className}" 
	onclick={() => modalStore.openModal('signup')}
>
	Sign Up!
</button>
