# Icon System Documentation

This directory contains a comprehensive icon system for the Communikey Svelte application. All icons are built using a consistent base component and organized by category for better maintainability and reusability.

## Structure

```
src/lib/components/icons/
├── Icon.svelte              # Base icon wrapper component
├── index.js                 # Barrel export for all icons
├── README.md               # This documentation
├── calendar/               # Calendar-related icons
│   ├── CalendarIcon.svelte
│   └── ClockIcon.svelte
├── ui/                     # General UI icons
│   ├── ChevronLeftIcon.svelte
│   ├── ChevronRightIcon.svelte
│   ├── ChevronDownIcon.svelte
│   ├── CloseIcon.svelte
│   ├── PlusIcon.svelte
│   ├── MenuIcon.svelte
│   ├── LocationIcon.svelte
│   ├── CheckIcon.svelte
│   └── FilterIcon.svelte
├── actions/                # Action-related icons
│   ├── CopyIcon.svelte
│   ├── RefreshIcon.svelte
│   └── ExternalLinkIcon.svelte
└── social/                 # Social/communication icons
    ├── ChatIcon.svelte
    ├── LightningIcon.svelte
    └── BookmarkIcon.svelte
```

## Usage

### Basic Import and Usage

```svelte
<script>
  import { CalendarIcon, CloseIcon, PlusIcon } from '$lib/components/icons';
</script>

<!-- Basic usage with default size (w-5 h-5) -->
<CalendarIcon />

<!-- Custom size -->
<CloseIcon class_="w-6 h-6" />

<!-- With custom title for accessibility -->
<PlusIcon class_="w-4 h-4" title="Add new item" />
```

### Available Props

All icon components accept the following props:

- `class_` (string): CSS classes for styling (default: 'w-5 h-5')
- `title` (string): Accessible title for the icon (default: varies by icon)

### Base Icon Component

The `Icon.svelte` component provides consistent styling and accessibility features:

- Consistent stroke width (2)
- Proper accessibility attributes
- Customizable colors via CSS classes
- Standard viewBox (0 0 24 24)

### Available Icons

#### Calendar Icons

- `CalendarIcon` - Calendar/date representation
- `ClockIcon` - Time/clock representation

#### UI Icons

- `ChevronLeftIcon` - Left arrow/previous navigation
- `ChevronRightIcon` - Right arrow/next navigation
- `ChevronDownIcon` - Down arrow/expand
- `CloseIcon` - Close/dismiss (X)
- `PlusIcon` - Add/create (+)
- `MenuIcon` - Menu/list (hamburger)
- `LocationIcon` - Location/map pin
- `CheckIcon` - Success/checkmark
- `FilterIcon` - Filter/sort

#### Action Icons

- `CopyIcon` - Copy to clipboard
- `RefreshIcon` - Refresh/reload
- `ExternalLinkIcon` - External link

#### Social Icons

- `ChatIcon` - Chat/message
- `LightningIcon` - Lightning/zap (filled icon)
- `BookmarkIcon` - Bookmark/save

## Adding New Icons

1. Create a new `.svelte` file in the appropriate category folder
2. Use the base `Icon` component as a wrapper
3. Add the SVG path(s) as slot content
4. Export the new icon in `index.js`

Example:

```svelte
<script>
  import Icon from '../Icon.svelte';

  export let class_ = 'w-5 h-5';
  export let title = 'Your Icon Name';
</script>

<Icon {class_} {title}>
  <path d="your-svg-path-here" />
</Icon>
```

## Migration from Inline SVGs

When replacing inline SVGs with icon components:

1. Find the SVG path data
2. Match it to an existing icon or create a new one
3. Replace the `<svg>` element with the icon component
4. Update the import statement
5. Adjust the `class_` prop as needed

### Before:

```svelte
<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
</svg>
```

### After:

```svelte
<script>
  import { CloseIcon } from '$lib/components/icons';
</script>

<CloseIcon class_="w-5 h-5" />
```

## Benefits

- **Consistency**: All icons follow the same styling patterns
- **Reusability**: Icons can be used across any component
- **Maintainability**: Single source of truth for each icon
- **Performance**: Eliminates duplicate SVG code
- **Accessibility**: Consistent aria-labels and titles
- **Type Safety**: Better IDE support and error catching
