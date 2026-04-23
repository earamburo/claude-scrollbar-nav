# ClaudeMap

A Chrome extension that adds a navigation sidebar to Claude.ai. Markers appear for each user message — click to jump, hover to preview.

## How it works

On load the extension runs through this sequence:

1. **loadSavedState** — reads visibility preference from Chrome storage
2. **findScrollContainer** — locates the scrollable div Claude uses
3. **createMinimap** — injects the sidebar into the page
4. **startObserving** — watches for new messages via MutationObserver
5. **setupChatChangeListener** — detects URL changes when switching chats
6. **scanConversation** — finds all user messages and renders markers

## Marker rendering

```
track userMessage elements
           ↓
     extractText()
           ↓
   build sections[]
           ↓
  renderSingleMarker()     ← one per message, stacked top to bottom
           ↓
    user clicks marker
           ↓
    jumpToSection()        ← smooth scroll with header offset
```

## DOM structure

```
#claude-minimap
└── .minimap-track
    └── .minimap-markers
        ├── .minimap-marker
        ├── .minimap-marker
        └── .minimap-marker
```

## State

| Field | Type | Purpose |
|---|---|---|
| `sections[]` | `Section[]` | User messages with their DOM elements |
| `markers[]` | `MarkerData[]` | Rendered marker elements |
| `scrollContainer` | `HTMLElement` | The scrollable div on the page |
| `isVisible` | `boolean` | Sidebar visibility |

## Stack

- TypeScript — class-based, no framework
- Native Web APIs — MutationObserver, getBoundingClientRect, scrollTo
- Chrome Extension Storage API — persists visibility preference
- Manifest V3

## File structure

```
content.ts        source
content.js        compiled
styles.css        sidebar styles
manifest.json     extension config
popup.html        extension popup
```

## Roadmap

- **v2** — toggle visibility, keyboard shortcuts (prev/next section), scroll sync indicator
- **v3** — clustering for very long conversations
ied
4. Unused response tracking code in sections

## Browser Compatibility

- Chrome/Chromium-based browsers
- Requires Manifest V3 support