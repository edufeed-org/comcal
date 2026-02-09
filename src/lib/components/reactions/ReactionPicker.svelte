<script>
  /**
   * ReactionPicker - Full emoji picker modal
   * @component
   */
  import { reactionsStore } from '$lib/stores/reactions.svelte.js';
  import { CloseIcon } from '$lib/components/icons';
  import * as m from '$lib/paraglide/messages';
  import { emojiMetadata } from '$lib/data/emojiMetadata.js';

  /** @type {any} */
  let { event, onClose } = $props();

  let loading = $state(false);
  let searchQuery = $state('');

  // Common emoji categories with translated names
  const emojiCategories = $derived(() => [
    {
      name: m.reactions_category_smileys(),
      emojis: [
        '😀',
        '😃',
        '😄',
        '😁',
        '😆',
        '😅',
        '🤣',
        '😂',
        '🙂',
        '🙃',
        '😉',
        '😊',
        '😇',
        '🥰',
        '😍',
        '🤩',
        '😘',
        '😗',
        '😚',
        '😙',
        '🥲',
        '😋',
        '😛',
        '😜',
        '🤪',
        '😝',
        '🤑',
        '🤗',
        '🤭',
        '🤫',
        '🤔',
        '🤐',
        '🤨',
        '😐',
        '😑',
        '😶',
        '😏',
        '😒',
        '🙄',
        '😬',
        '🤥',
        '😌',
        '😔',
        '😪',
        '🤤',
        '😴',
        '😷',
        '🤒',
        '🤕',
        '🤢',
        '🤮',
        '🤧',
        '🥵',
        '🥶',
        '😶‍🌫️',
        '😵',
        '😵‍💫',
        '🤯',
        '🤠',
        '🥳',
        '🥸',
        '😎',
        '🤓',
        '🧐',
        '😕',
        '😟',
        '🙁',
        '☹️',
        '😮',
        '😯',
        '😲',
        '😳',
        '🥺',
        '😦',
        '😧',
        '😨',
        '😰',
        '😥',
        '😢',
        '😭',
        '😱',
        '😖',
        '😣',
        '😞',
        '😓',
        '😩',
        '😫',
        '🥱',
        '😤',
        '😡',
        '😠',
        '🤬',
        '😈',
        '👿',
        '💀',
        '☠️',
        '💩',
        '🤡',
        '👹',
        '👺',
        '👻',
        '👽',
        '👾',
        '🤖',
        '😺',
        '😸',
        '😹',
        '😻',
        '😼',
        '😽',
        '🙀',
        '😿',
        '😾'
      ]
    },
    {
      name: m.reactions_category_gestures(),
      emojis: [
        '👋',
        '🤚',
        '🖐️',
        '✋',
        '🖖',
        '👌',
        '🤌',
        '🤏',
        '✌️',
        '🤞',
        '🤟',
        '🤘',
        '🤙',
        '👈',
        '👉',
        '👆',
        '🖕',
        '👇',
        '☝️',
        '👍',
        '👎',
        '✊',
        '👊',
        '🤛',
        '🤜',
        '👏',
        '🙌',
        '👐',
        '🤲',
        '🤝',
        '🙏'
      ]
    },
    {
      name: m.reactions_category_hearts(),
      emojis: [
        '❤️',
        '🧡',
        '💛',
        '💚',
        '💙',
        '💜',
        '🖤',
        '🤍',
        '🤎',
        '💔',
        '❣️',
        '💕',
        '💞',
        '💓',
        '💗',
        '💖',
        '💘',
        '💝',
        '💟'
      ]
    },
    {
      name: m.reactions_category_celebrations(),
      emojis: [
        '🎉',
        '🎊',
        '🎈',
        '🎁',
        '🏆',
        '🥇',
        '🥈',
        '🥉',
        '⭐',
        '🌟',
        '✨',
        '💫',
        '🔥',
        '💥',
        '💯',
        '✅',
        '☑️'
      ]
    },
    {
      name: m.reactions_category_nature(),
      emojis: [
        '🌸',
        '🌺',
        '🌼',
        '🌻',
        '🌞',
        '🌝',
        '🌛',
        '🌜',
        '🌚',
        '🌕',
        '🌖',
        '🌗',
        '🌘',
        '🌑',
        '🌒',
        '🌓',
        '🌔',
        '🌙',
        '⭐',
        '🌟',
        '✨',
        '⚡',
        '☄️',
        '💥',
        '🔥',
        '🌪️',
        '🌈',
        '☀️',
        '🌤️',
        '⛅',
        '🌥️',
        '☁️',
        '🌦️',
        '🌧️',
        '⛈️',
        '🌩️',
        '🌨️',
        '❄️',
        '☃️',
        '⛄',
        '🌬️',
        '💨'
      ]
    },
    {
      name: m.reactions_category_food(),
      emojis: [
        '🍎',
        '🍊',
        '🍋',
        '🍌',
        '🍉',
        '🍇',
        '🍓',
        '🫐',
        '🍈',
        '🍒',
        '🍑',
        '🥭',
        '🍍',
        '🥥',
        '🥝',
        '🍅',
        '🍆',
        '🥑',
        '🥦',
        '🥬',
        '🥒',
        '🌶️',
        '🫑',
        '🌽',
        '🥕',
        '🫒',
        '🧄',
        '🧅',
        '🥔',
        '🍠',
        '🥐',
        '🥯',
        '🍞',
        '🥖',
        '🥨',
        '🧀',
        '🥚',
        '🍳',
        '🧈',
        '🥞',
        '🧇',
        '🥓',
        '🥩',
        '🍗',
        '🍖',
        '🦴',
        '🌭',
        '🍔',
        '🍟',
        '🍕',
        '🫓',
        '🥪',
        '🥙',
        '🧆',
        '🌮',
        '🌯',
        '🫔',
        '🥗',
        '🥘',
        '🫕',
        '🥫',
        '🍝',
        '🍜',
        '🍲',
        '🍛',
        '🍣',
        '🍱',
        '🥟',
        '🦪',
        '🍤',
        '🍙',
        '🍚',
        '🍘',
        '🍥',
        '🥠',
        '🥮',
        '🍢',
        '🍡',
        '🍧',
        '🍨',
        '🍦',
        '🥧',
        '🧁',
        '🍰',
        '🎂',
        '🍮',
        '🍭',
        '🍬',
        '🍫',
        '🍿',
        '🍩',
        '🍪',
        '🌰',
        '🥜',
        '🍯',
        '🥛',
        '🍼',
        '🫖',
        '☕',
        '🍵',
        '🧃',
        '🥤',
        '🧋',
        '🍶',
        '🍺',
        '🍻',
        '🥂',
        '🍷',
        '🥃',
        '🍸',
        '🍹',
        '🧉',
        '🍾',
        '🧊'
      ]
    },
    {
      name: m.reactions_category_activities(),
      emojis: [
        '⚽',
        '🏀',
        '🏈',
        '⚾',
        '🥎',
        '🎾',
        '🏐',
        '🏉',
        '🥏',
        '🎱',
        '🪀',
        '🏓',
        '🏸',
        '🏒',
        '🏑',
        '🥍',
        '🏏',
        '🪃',
        '🥅',
        '⛳',
        '🪁',
        '🏹',
        '🎣',
        '🤿',
        '🥊',
        '🥋',
        '🎽',
        '🛹',
        '🛼',
        '🛷',
        '⛸️',
        '🥌',
        '🎿',
        '⛷️',
        '🏂',
        '🪂',
        '🏋️',
        '🤼',
        '🤸',
        '🤺',
        '⛹️',
        '🤾',
        '🏌️',
        '🏇',
        '🧘',
        '🏊',
        '🤽',
        '🚣',
        '🧗',
        '🚵',
        '🚴',
        '🏆',
        '🥇',
        '🥈',
        '🥉',
        '🏅',
        '🎖️',
        '🎗️',
        '🏵️',
        '🎫',
        '🎟️',
        '🎪',
        '🤹',
        '🎭',
        '🎨',
        '🎬',
        '🎤',
        '🎧',
        '🎼',
        '🎹',
        '🥁',
        '🪘',
        '🎷',
        '🎺',
        '🪗',
        '🎸',
        '🪕',
        '🎻',
        '🎲',
        '♟️',
        '🎯',
        '🎳',
        '🎮',
        '🎰',
        '🧩'
      ]
    },
    {
      name: m.reactions_category_objects(),
      emojis: [
        '💡',
        '🔦',
        '🕯️',
        '🪔',
        '🧯',
        '🛢️',
        '💸',
        '💵',
        '💴',
        '💶',
        '💷',
        '🪙',
        '💰',
        '💳',
        '🪪',
        '💎',
        '⚖️',
        '🪜',
        '🧰',
        '🪛',
        '🔧',
        '🔨',
        '⚒️',
        '🛠️',
        '⛏️',
        '🪚',
        '🔩',
        '⚙️',
        '🪤',
        '🧱',
        '⛓️',
        '🧲',
        '🔫',
        '💣',
        '🧨',
        '🪓',
        '🔪',
        '🗡️',
        '⚔️',
        '🛡️',
        '🚬',
        '⚰️',
        '🪦',
        '⚱️',
        '🏺',
        '🔮',
        '📿',
        '🧿',
        '💈',
        '⚗️',
        '🔭',
        '🔬',
        '🕳️',
        '🩹',
        '🩺',
        '💊',
        '💉',
        '🩸',
        '🧬',
        '🦠',
        '🧫',
        '🧪',
        '🌡️',
        '🧹',
        '🪠',
        '🧺',
        '🧻',
        '🪣',
        '🧼',
        '🪥',
        '🧽',
        '🧴',
        '🛎️',
        '🔑',
        '🗝️',
        '🚪',
        '🪑',
        '🛋️',
        '🛏️',
        '🛌',
        '🧸',
        '🪆',
        '🖼️',
        '🪞',
        '🪟',
        '🛍️',
        '🛒',
        '🎁',
        '🎈',
        '🎏',
        '🎀',
        '🪄',
        '🪅',
        '🎊',
        '🎉',
        '🎎',
        '🏮',
        '🎐',
        '🧧',
        '✉️',
        '📩',
        '📨',
        '📧',
        '💌',
        '📥',
        '📤',
        '📦',
        '🏷️',
        '🪧',
        '📪',
        '📫',
        '📬',
        '📭',
        '📮',
        '📯',
        '📜',
        '📃',
        '📄',
        '📑',
        '🧾',
        '📊',
        '📈',
        '📉',
        '🗒️',
        '🗓️',
        '📆',
        '📅',
        '🗑️',
        '📇',
        '🗃️',
        '🗳️',
        '🗄️',
        '📋',
        '📁',
        '📂',
        '🗂️',
        '🗞️',
        '📰',
        '📓',
        '📔',
        '📒',
        '📕',
        '📗',
        '📘',
        '📙',
        '📚',
        '📖',
        '🔖',
        '🧷',
        '🔗',
        '📎',
        '🖇️',
        '📐',
        '📏',
        '🧮',
        '📌',
        '📍',
        '✂️',
        '🖊️',
        '🖋️',
        '✒️',
        '🖌️',
        '🖍️',
        '📝',
        '✏️',
        '🔍',
        '🔎',
        '🔏',
        '🔐',
        '🔒',
        '🔓'
      ]
    }
  ]);

  // Filter emojis based on search
  const filteredCategories = $derived(() => {
    if (!searchQuery.trim()) return emojiCategories();

    const query = searchQuery.toLowerCase();
    return emojiCategories()
      .map((category) => ({
        ...category,
        emojis: category.emojis.filter((/** @type {string} */ emoji) => {
          const metadata = /** @type {string[] | undefined} */ (
            emojiMetadata[/** @type {keyof typeof emojiMetadata} */ (emoji)]
          );
          // If no metadata exists, exclude from search results
          if (!metadata) return false;

          // Check if any keyword matches the search query
          return metadata.some((/** @type {string} */ keyword) =>
            keyword.toLowerCase().includes(query)
          );
        })
      }))
      .filter((category) => category.emojis.length > 0);
  });

  /**
   * @param {string} emoji
   */
  async function selectEmoji(emoji) {
    if (loading) return;

    loading = true;
    try {
      await reactionsStore.react(event, emoji);
      onClose();
    } catch (error) {
      console.error('Failed to add reaction:', error);
    } finally {
      loading = false;
    }
  }

  /**
   * @param {MouseEvent} e
   */
  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }
</script>

<!-- Modal backdrop -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
  onclick={handleBackdropClick}
  role="presentation"
  data-testid="reaction-picker"
>
  <!-- Modal content -->
  <div class="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg bg-gray-800 shadow-xl">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-gray-700 p-4">
      <h3 class="text-lg font-semibold text-white">{m.reactions_picker_title()}</h3>
      <button
        type="button"
        onclick={onClose}
        class="p-1 text-gray-400 transition-colors hover:text-white"
        aria-label="Close"
      >
        <CloseIcon class_="w-5 h-5" />
      </button>
    </div>

    <!-- Search -->
    <div class="border-b border-gray-700 p-4">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder={m.reactions_picker_search_placeholder()}
        class="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
    </div>

    <!-- Emoji grid -->
    <div class="flex-1 overflow-y-auto p-4">
      {#each filteredCategories() as category (category.name)}
        <div class="mb-6">
          <h4 class="mb-2 text-sm font-medium text-gray-400">{category.name}</h4>
          <div class="grid grid-cols-8 gap-2">
            {#each category.emojis as emoji (emoji)}
              <button
                type="button"
                onclick={() => selectEmoji(emoji)}
                disabled={loading}
                class="rounded p-2 text-2xl transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                title={emoji}
                data-testid="reaction-option"
                data-emoji={emoji}
              >
                {emoji}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
