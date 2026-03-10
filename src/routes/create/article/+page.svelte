<script>
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { nip19 } from 'nostr-tools';
  import { ChevronLeftIcon } from '$lib/components/icons';
  import { fetchEventById } from '$lib/helpers/nostrUtils';
  import { runtimeConfig } from '$lib/stores/config.svelte.js';
  import { manager } from '$lib/stores/accounts.svelte';
  import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
  import { getArticleTitle, getArticleSummary, getArticleImage } from 'applesauce-common/helpers';
  import { createArticle, updateArticle } from '$lib/stores/article-actions.svelte.js';
  import MarkdownRenderer from '$lib/components/shared/MarkdownRenderer.svelte';
  import EditableList from '$lib/components/shared/EditableList.svelte';
  import BlossomUploader from '$lib/components/educational/BlossomUploader.svelte';
  import { BlossomClient } from 'blossom-client-sdk';
  import { getActiveBlossomServer } from '$lib/services/blossom-settings-service.js';
  import * as m from '$lib/paraglide/messages';

  /** @type {{ data: { communityPubkey: string, editNaddr: string } }} */
  let { data } = $props();

  // Edit mode state
  let editEvent = $state(/** @type {any} */ (null));
  let isLoadingEdit = $state(false);
  let editError = $state('');

  const isEditMode = $derived(!!data.editNaddr);

  // Form state
  let title = $state('');
  let summary = $state('');
  let editorContent = $state('');
  let coverImageFiles = $state(/** @type {any[]} */ ([]));
  let hashtags = $state(/** @type {string[]} */ ([]));

  // UI state
  let activeTab = $state(/** @type {'write' | 'preview'} */ ('write'));
  let isPublishing = $state(false);
  let validationError = $state('');
  let imageUploading = $state(false);

  /** @type {HTMLTextAreaElement | null} */
  let textareaRef = $state(null);
  /** @type {HTMLInputElement | null} */
  let imageInputRef = $state(null);

  const coverImage = $derived(coverImageFiles[0]?.url || '');

  // Resolve edit naddr to event
  $effect(() => {
    if (!data.editNaddr) return;

    isLoadingEdit = true;
    editError = '';

    (async () => {
      try {
        const decoded = nip19.decode(data.editNaddr);
        if (decoded.type !== 'naddr') {
          editError = 'Invalid address format';
          return;
        }

        const event = await fetchEventById(data.editNaddr);
        if (!event) {
          editError = 'Article not found';
          return;
        }

        editEvent = event;
        title = getArticleTitle(event) || '';
        summary = getArticleSummary(event) || '';
        editorContent = event.content || '';
        const img = getArticleImage(event);
        if (img) {
          coverImageFiles = [{ url: img, name: 'cover', type: 'image/*', size: 0 }];
        }
        hashtags =
          event.tags
            ?.filter((/** @type {any} */ t) => t[0] === 't')
            .map((/** @type {any} */ t) => t[1]) || [];
      } catch (err) {
        console.error('Error loading article for edit:', err);
        editError = 'Failed to load article';
      } finally {
        isLoadingEdit = false;
      }
    })();
  });

  function handleBack() {
    history.back();
  }

  /**
   * Insert markdown syntax at cursor position in textarea
   * @param {string} before - Text to insert before selection
   * @param {string} after - Text to insert after selection
   * @param {string} [placeholder] - Default text if nothing selected
   */
  function insertMarkdown(before, after, placeholder = '') {
    if (!textareaRef) return;

    const start = textareaRef.selectionStart;
    const end = textareaRef.selectionEnd;
    const selected = editorContent.substring(start, end) || placeholder;

    const newText =
      editorContent.substring(0, start) + before + selected + after + editorContent.substring(end);

    editorContent = newText;

    // Restore cursor position after the inserted text
    requestAnimationFrame(() => {
      if (!textareaRef) return;
      const cursorPos = start + before.length + selected.length;
      textareaRef.focus();
      textareaRef.setSelectionRange(cursorPos, cursorPos);
    });
  }

  function toolbarBold() {
    insertMarkdown('**', '**', 'bold text');
  }
  function toolbarItalic() {
    insertMarkdown('*', '*', 'italic text');
  }
  function toolbarHeading() {
    insertMarkdown('## ', '', 'Heading');
  }
  function toolbarLink() {
    insertMarkdown('[', '](url)', 'link text');
  }
  function toolbarList() {
    insertMarkdown('- ', '', 'list item');
  }
  function toolbarQuote() {
    insertMarkdown('> ', '', 'quote');
  }
  function toolbarCode() {
    insertMarkdown('```\n', '\n```', 'code');
  }

  /** Open file picker for inline image upload */
  function toolbarImage() {
    imageInputRef?.click();
  }

  /**
   * Handle image file selected for inline insertion
   * @param {Event} e
   */
  async function handleImageUpload(e) {
    const input = /** @type {HTMLInputElement} */ (e.target);
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    const activeUser = manager.active;
    if (!activeUser?.signer) return;

    imageUploading = true;
    try {
      const signer = async (/** @type {any} */ event) => {
        if (!activeUser) throw new Error('User not available');
        return await activeUser.signEvent(event);
      };

      const serverUrl = getActiveBlossomServer(activeUser.pubkey, eventStore);
      const client = new BlossomClient(serverUrl, signer);
      const blob = await client.uploadBlob(file);

      insertMarkdown(`![${file.name}](`, ')', blob.url);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      imageUploading = false;
    }
  }

  async function handlePublish() {
    validationError = '';

    if (!title.trim()) {
      validationError = m.article_editor_validation_title();
      return;
    }
    if (!editorContent.trim()) {
      validationError = m.article_editor_validation_content();
      return;
    }

    isPublishing = true;
    try {
      /** @type {import('$lib/stores/article-actions.svelte.js').ArticleFormData} */
      const formData = {
        title: title.trim(),
        content: editorContent,
        summary: summary.trim() || undefined,
        image: coverImage || undefined,
        hashtags: hashtags.length > 0 ? hashtags : undefined
      };

      let naddr;
      if (isEditMode && editEvent) {
        const result = await updateArticle(formData, editEvent);
        naddr = result.naddr;
      } else {
        const result = await createArticle(formData, data.communityPubkey || undefined, undefined);
        naddr = result.naddr;
      }

      if (naddr) {
        goto(resolve(`/${naddr}`));
      } else {
        handleBack();
      }
    } catch (err) {
      console.error('Publish failed:', err);
      validationError = err instanceof Error ? err.message : 'Publishing failed';
    } finally {
      isPublishing = false;
    }
  }

  /** @type {{label: string, action: () => void, icon: string}[]} */
  const toolbarButtons = [
    { label: 'Bold', action: toolbarBold, icon: 'B' },
    { label: 'Italic', action: toolbarItalic, icon: 'I' },
    { label: 'Heading', action: toolbarHeading, icon: 'H' },
    { label: 'Link', action: toolbarLink, icon: '🔗' },
    { label: 'Image', action: toolbarImage, icon: '🖼' },
    { label: 'List', action: toolbarList, icon: '•' },
    { label: 'Quote', action: toolbarQuote, icon: '❝' },
    { label: 'Code', action: toolbarCode, icon: '</>' }
  ];
</script>

<svelte:head>
  <title>
    {isEditMode ? m.article_editor_page_title_edit() : m.article_editor_page_title_create()} - {runtimeConfig.appName}
  </title>
</svelte:head>

<!-- Hidden file input for inline image uploads -->
<input
  type="file"
  accept="image/*"
  class="hidden"
  bind:this={imageInputRef}
  onchange={handleImageUpload}
/>

<div class="min-h-[calc(100vh-4rem)]">
  <!-- Top bar -->
  <div class="border-b border-base-300 bg-base-100">
    <div class="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
      <button class="btn btn-ghost btn-sm" onclick={handleBack} aria-label="Go back">
        <ChevronLeftIcon class_="w-5 h-5" />
      </button>
      <h1 class="text-lg font-semibold text-base-content">
        {isEditMode ? m.article_editor_page_title_edit() : m.article_editor_page_title_create()}
      </h1>
    </div>
  </div>

  <!-- Content -->
  {#if isLoadingEdit}
    <div class="flex items-center justify-center py-20">
      <span class="loading loading-lg loading-spinner text-primary"></span>
    </div>
  {:else if editError}
    <div class="mx-auto max-w-3xl px-4 py-10">
      <div class="alert alert-error">
        <span>{editError}</span>
      </div>
      <button class="btn mt-4 btn-outline" onclick={handleBack}>Go Back</button>
    </div>
  {:else}
    <div class="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <!-- Title -->
      <input
        type="text"
        class="input w-full text-2xl font-bold"
        placeholder={m.article_editor_title_placeholder()}
        bind:value={title}
      />

      <!-- Cover Image -->
      <BlossomUploader
        bind:files={coverImageFiles}
        multiple={false}
        accept="image/*"
        label={m.article_editor_cover_image()}
      />

      <!-- Summary -->
      <textarea
        class="textarea w-full"
        rows="2"
        placeholder={m.article_editor_summary_placeholder()}
        bind:value={summary}
      ></textarea>

      <!-- Markdown Editor -->
      <div class="overflow-hidden rounded-lg border border-base-300">
        <!-- Tab bar + toolbar -->
        <div
          class="flex flex-wrap items-center gap-1 border-b border-base-300 bg-base-200 px-2 py-1"
        >
          <!-- Tabs -->
          <button
            class="btn btn-xs"
            class:btn-active={activeTab === 'write'}
            onclick={() => (activeTab = 'write')}
          >
            {m.article_editor_tab_write()}
          </button>
          <button
            class="btn btn-xs"
            class:btn-active={activeTab === 'preview'}
            onclick={() => (activeTab = 'preview')}
          >
            {m.article_editor_tab_preview()}
          </button>

          <!-- Separator -->
          <div class="mx-1 h-4 w-px bg-base-300"></div>

          <!-- Toolbar (only in write mode) -->
          {#if activeTab === 'write'}
            {#each toolbarButtons as btn (btn.label)}
              <button
                class="btn font-mono btn-ghost btn-xs"
                title={btn.label}
                onclick={btn.action}
                disabled={imageUploading && btn.label === 'Image'}
              >
                {#if imageUploading && btn.label === 'Image'}
                  <span class="loading loading-xs loading-spinner"></span>
                {:else}
                  {btn.icon}
                {/if}
              </button>
            {/each}
          {/if}
        </div>

        <!-- Editor / Preview area -->
        {#if activeTab === 'write'}
          <textarea
            bind:this={textareaRef}
            class="w-full resize-y bg-base-100 p-4 font-mono text-sm focus:outline-none"
            style="min-height: 400px;"
            placeholder={m.article_editor_content_placeholder()}
            bind:value={editorContent}
          ></textarea>
        {:else}
          <div class="min-h-[400px] p-4">
            {#if editorContent.trim()}
              <MarkdownRenderer
                content={editorContent}
                class="prose prose-lg max-w-none prose-a:text-primary prose-img:rounded-lg"
              />
            {:else}
              <p class="text-base-content/50 italic">{m.article_editor_content_placeholder()}</p>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Hashtags -->
      <EditableList
        bind:items={hashtags}
        label={m.article_editor_hashtags_label()}
        placeholder={m.article_editor_hashtags_placeholder()}
        buttonText="+"
        itemType="hashtag"
      />

      <!-- Validation Error -->
      {#if validationError}
        <div class="alert alert-error">
          <span>{validationError}</span>
        </div>
      {/if}

      <!-- Publish Button -->
      <button class="btn w-full btn-primary" onclick={handlePublish} disabled={isPublishing}>
        {#if isPublishing}
          <span class="loading loading-sm loading-spinner"></span>
          {m.article_editor_publishing()}
        {:else if isEditMode}
          {m.article_editor_update()}
        {:else}
          {m.article_editor_publish()}
        {/if}
      </button>
    </div>
  {/if}
</div>
