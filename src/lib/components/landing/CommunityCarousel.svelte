<script lang="ts">
	import { onMount } from 'svelte';
	import emblaCarouselSvelte from 'embla-carousel-svelte';
	import CommunikeyCard from '$lib/components/CommunikeyCard.svelte';
	import { ChevronLeftIcon, ChevronRightIcon } from '$lib/components/icons';
	import { useAllCommunities } from '$lib/stores/all-communities.svelte.js';

	const getAllCommunities = useAllCommunities();
	const communities = $derived(getAllCommunities());

	let showAll = $state(false);
	let autoScrollInterval = $state<number | null>(null);
	let isHovered = $state(false);
	let emblaApi = $state<any>(null);
	let selectedIndex = $state(0);

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

	// Initialize Embla carousel
	function handleEmblaInit(emblaInstance: any) {
		emblaApi = emblaInstance;
		
		// Set up event listeners
		emblaApi.on('select', () => {
			selectedIndex = emblaApi.selectedScrollSnap();
		});

		// Initialize selected index
		selectedIndex = emblaApi.selectedScrollSnap();
	}

	// Auto-scroll functionality
	$effect(() => {
		if (!isHovered && !showAll && emblaApi && slides().length > 1) {
			autoScrollInterval = setInterval(() => {
				if (emblaApi) {
					emblaApi.scrollNext();
				}
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
		if (!showAll && emblaApi) {
			// Reset to first slide when collapsing
			emblaApi.scrollTo(0);
		}
	}

	function scrollPrev() {
		if (emblaApi) {
			emblaApi.scrollPrev();
		}
	}

	function scrollNext() {
		if (emblaApi) {
			emblaApi.scrollNext();
		}
	}

	function scrollTo(index: number) {
		if (emblaApi) {
			emblaApi.scrollTo(index);
		}
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
				<div 
					class="overflow-hidden rounded-box"
					use:emblaCarouselSvelte={{ 
						options: { loop: true, align: 'start' },
						plugins: []
					}}
					onemblaInit={(e) => handleEmblaInit(e.detail)}
				>
					<div class="flex">
						{#each slides() as slide, index (index)}
							<div class="min-w-0 flex-[0_0_100%]">
								<!-- Grid of community cards -->
								<div class="grid w-full gap-4 p-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
									{#each slide as community (community.pubkey)}
										<CommunikeyCard pubkey={community.pubkey} />
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Navigation buttons -->
				{#if slides().length > 1}
					<div class="absolute left-5 right-5 top-1/2 flex -translate-y-1/2 transform justify-between pointer-events-none">
						<button 
							onclick={scrollPrev}
							class="btn btn-circle btn-primary shadow-lg pointer-events-auto"
							aria-label="Previous slide"
						>
							<ChevronLeftIcon class_="h-6 w-6" />
						</button>
						<button 
							onclick={scrollNext}
							class="btn btn-circle btn-primary shadow-lg pointer-events-auto"
							aria-label="Next slide"
						>
							<ChevronRightIcon class_="h-6 w-6" />
						</button>
					</div>
				{/if}

				<!-- Dot indicators -->
				{#if slides().length > 1}
					<div class="mt-8 flex justify-center gap-3">
						{#each slides() as _, index}
							<button 
								onclick={() => scrollTo(index)}
								class="group flex items-center justify-center p-2 rounded-full hover:bg-base-200 transition-all duration-300"
								aria-label="Go to slide {index + 1}"
							>
								<div 
									class="h-3 w-3 rounded-full transition-all duration-300 {selectedIndex === index ? 'bg-primary scale-125' : 'bg-base-300 group-hover:bg-primary group-hover:scale-125'}"
								></div>
							</button>
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
