<script lang="ts">
	import CommunikeyCard from '$lib/components/CommunikeyCard.svelte';
	import { ChevronLeftIcon, ChevronRightIcon } from '$lib/components/icons';
	import { useAllCommunities } from '$lib/stores/all-communities.svelte.js';

	const getAllCommunities = useAllCommunities();
	const communities = $derived(getAllCommunities());

	let showAll = $state(false);
	let autoScrollInterval = $state<number | null>(null);
	let isHovered = $state(false);

	// Calculate how many cards to show per slide based on screen width
	let cardsPerSlide = $state(4);

	// Update cards per slide on mount and resize
	$effect(() => {
		function updateCardsPerSlide() {
			const width = window.innerWidth;
			if (width < 768) {
				cardsPerSlide = 1;
			} else if (width < 1024) {
				cardsPerSlide = 2;
			} else if (width < 1280) {
				cardsPerSlide = 3;
			} else {
				cardsPerSlide = 4;
			}
		}

		updateCardsPerSlide();
		window.addEventListener('resize', updateCardsPerSlide);

		return () => {
			window.removeEventListener('resize', updateCardsPerSlide);
		};
	});

	// Group communities into slides
	const slides = $derived(() => {
		if (communities.length === 0) return [];
		
		const result = [];
		for (let i = 0; i < communities.length; i += cardsPerSlide) {
			result.push(communities.slice(i, i + cardsPerSlide));
		}
		return result;
	});

	// Auto-scroll functionality for carousel
	$effect(() => {
		if (!isHovered && !showAll && slides().length > 1) {
			let currentSlide = 0;
			
			autoScrollInterval = setInterval(() => {
				currentSlide = (currentSlide + 1) % slides().length;
				window.location.hash = `#slide${currentSlide + 1}`;
			}, 5000);

			return () => {
				if (autoScrollInterval) {
					clearInterval(autoScrollInterval);
				}
			};
		}
	});

	function handleMouseEnter() {
		isHovered = true;
	}

	function handleMouseLeave() {
		isHovered = false;
	}

	function toggleShowAll() {
		showAll = !showAll;
		if (!showAll) {
			// Reset to first slide when collapsing
			window.location.hash = '#slide1';
		}
	}

	// Get prev/next slide numbers for circular navigation
	function getPrevSlide(currentSlide: number, totalSlides: number) {
		return currentSlide === 1 ? totalSlides : currentSlide - 1;
	}

	function getNextSlide(currentSlide: number, totalSlides: number) {
		return currentSlide === totalSlides ? 1 : currentSlide + 1;
	}
</script>

<section id="community-showcase" class="bg-base-100 py-16">
	<div class="container mx-auto px-4">
		<!-- Section header -->
		<div class="mb-12 text-center">
			<h2 class="mb-4 text-3xl font-bold text-base-content md:text-4xl">
				Discover Communities
			</h2>
			<p class="text-lg text-base-content/70">
				Join vibrant communities and connect with people who share your interests
			</p>
		</div>

		{#if communities.length === 0}
			<!-- Loading state -->
			<div class="flex justify-center py-12">
				<div class="loading loading-spinner loading-lg text-primary"></div>
			</div>
		{:else if showAll}
			<!-- Grid view - all communities -->
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each communities as community (community.pubkey)}
					<CommunikeyCard pubkey={community.pubkey} />
				{/each}
			</div>

			<!-- Show less button -->
			<div class="mt-8 text-center">
				<button onclick={toggleShowAll} class="btn btn-primary btn-lg">
					Show Less ←
				</button>
			</div>
		{:else}
			<!-- Carousel view -->
			<div 
				class="relative"
				onmouseenter={handleMouseEnter}
				onmouseleave={handleMouseLeave}
			>
				<div class="carousel w-full rounded-box">
					{#each slides() as slide, index (index)}
						{@const slideNumber = index + 1}
						{@const totalSlides = slides().length}
						{@const prevSlide = getPrevSlide(slideNumber, totalSlides)}
						{@const nextSlide = getNextSlide(slideNumber, totalSlides)}
						
						<div id="slide{slideNumber}" class="carousel-item relative w-full">
							<!-- Grid of community cards -->
							<div class="grid w-full gap-4 p-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
								{#each slide as community (community.pubkey)}
									<CommunikeyCard pubkey={community.pubkey} />
								{/each}
							</div>

							<!-- Navigation buttons -->
							{#if totalSlides > 1}
								<div class="absolute left-5 right-5 top-1/2 flex -translate-y-1/2 transform justify-between">
									<a href="#slide{prevSlide}" class="btn btn-circle btn-primary shadow-lg">
										<ChevronLeftIcon class_="h-6 w-6" />
									</a>
									<a href="#slide{nextSlide}" class="btn btn-circle btn-primary shadow-lg">
										<ChevronRightIcon class_="h-6 w-6" />
									</a>
								</div>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Dot indicators -->
				{#if slides().length > 1}
					<div class="mt-8 flex justify-center gap-2">
						{#each slides() as _, index}
							<a 
								href="#slide{index + 1}"
								class="h-2 w-2 rounded-full transition-all duration-300 bg-base-300 hover:bg-base-400"
								aria-label="Go to slide {index + 1}"
							></a>
						{/each}
					</div>
				{/if}
			</div>

			<!-- View all link -->
			<div class="mt-8 text-center">
				<button onclick={toggleShowAll} class="link link-primary text-lg font-medium">
					View All Communities →
				</button>
			</div>
		{/if}
	</div>
</section>
