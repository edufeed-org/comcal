<script>
	import { modalStore } from '$lib/stores/modal.svelte.js';

	function handleGetStarted() {
		modalStore.openModal('signup');
	}

	function scrollToCommunities() {
		const carousel = document.querySelector('#community-showcase');
		if (carousel) {
			carousel.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}
</script>

<section class="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-secondary py-20 text-primary-content">
	<!-- Decorative elements -->
	<div class="absolute inset-0 opacity-10">
		<div class="absolute -left-4 top-10 h-72 w-72 rounded-full bg-white blur-3xl"></div>
		<div class="absolute -right-4 bottom-10 h-96 w-96 rounded-full bg-white blur-3xl"></div>
	</div>

	<div class="container relative z-10 mx-auto px-4">
		<!-- Main headline -->
		<div class="mx-auto max-w-4xl text-center">
			<h1 class="mb-6 text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
				Connect, Organize, and Collaborate in Decentralized Communities
			</h1>
			<p class="mb-8 text-lg opacity-90 md:text-xl lg:text-2xl">
				Join topic-based communities, coordinate events, and engage in real-time discussions—all powered by the Nostr protocol
			</p>

		<!-- Feature badges -->
		<div class="mb-10 flex flex-wrap justify-center gap-4">
			<div class="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm">
				<span class="text-2xl">🏘️</span>
				<span class="font-medium">Communities</span>
			</div>
			<div class="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm">
				<span class="text-2xl">💬</span>
				<span class="font-medium">Chat</span>
			</div>
			<a 
				href="/calendar"
				class="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm transition-opacity hover:opacity-80 cursor-pointer"
			>
				<span class="text-2xl">📅</span>
				<span class="font-medium">Calendar</span>
			</a>
			<div class="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm">
				<span class="text-2xl">✨</span>
				<span class="font-medium">More to come</span>
			</div>
		</div>

			<!-- Call to action buttons -->
			<div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
				<button
					onclick={handleGetStarted}
					class="btn btn-lg bg-white text-primary hover:bg-white/90 border-none shadow-lg"
				>
					Get Started
				</button>
				<button
					onclick={scrollToCommunities}
					class="btn btn-lg btn-outline border-2 border-white text-white hover:bg-white hover:text-primary"
				>
					Explore Communities
				</button>
			</div>
		</div>
	</div>
</section>
