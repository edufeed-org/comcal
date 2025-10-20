<script>
	import { CalendarIcon, ChatIcon, GlobeIcon } from '$lib/components/icons';
</script>

<section class="bg-base-200 py-16">
	<div class="container mx-auto px-4">
		<div class="grid grid-cols-1 gap-8 md:grid-cols-3">
			<!-- Communities Feature -->
			<div class="card bg-base-100 shadow-lg transition-all duration-300 hover:shadow-xl">
				<div class="card-body items-center text-center">
					<div class="mb-4 rounded-full bg-primary/10 p-4">
						<GlobeIcon class_="h-12 w-12 text-primary" />
					</div>
					<h3 class="card-title text-2xl font-bold text-base-content">Communities</h3>
					<p class="text-base-content/70">
						Discover and join communities aligned with your interests. Connect with like-minded individuals and share your passion.
					</p>
				</div>
			</div>

			<!-- Calendar Feature -->
			<div class="card bg-base-100 shadow-lg transition-all duration-300 hover:shadow-xl">
				<div class="card-body items-center text-center">
					<div class="mb-4 rounded-full bg-secondary/10 p-4">
						<CalendarIcon class_="h-12 w-12 text-secondary" />
					</div>
					<h3 class="card-title text-2xl font-bold text-base-content">Calendar</h3>
					<p class="text-base-content/70">
						Coordinate events and never miss what matters. Create, share, and attend community events with ease.
					</p>
				</div>
			</div>

			<!-- Decentralized Feature -->
			<div class="card bg-base-100 shadow-lg transition-all duration-300 hover:shadow-xl">
				<div class="card-body items-center text-center">
					<div class="mb-4 rounded-full bg-accent/10 p-4">
						<ChatIcon class_="h-12 w-12 text-accent" />
					</div>
					<h3 class="card-title text-2xl font-bold text-base-content">Decentralized</h3>
					<p class="text-base-content/70">
						Your data, your control. Powered by the Nostr protocol for censorship-resistant, decentralized communication.
					</p>
				</div>
			</div>
		</div>
	</div>
</section>
