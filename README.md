# Claude Minimap Navigator

A Chrome extension that adds a visual minimap/scrollbar to Claude.ai for easy conversation navigation.

## Architecture Overview

### Initialization Flow

The extension follows a sequential initialization process:

1. **init()** - Entry point when page loads
2. **loadSavedState()** - Retrieves visibility preference from Chrome storage
3. **Wait 1 second** - Allows page to fully load
4. **findScrollContainer()** - Locates the scrollable element on the page
5. **createMinimap()** - Injects HTML structure into the DOM
6. **attachEventListeners()** - Sets up click and hover handlers
7. **startObserving()** - Monitors DOM for new messages via MutationObserver
8. **setupScrollSync()** - Synchronizes viewport indicator with scroll position
9. **setupKeyboardShortcuts()** - Enables Ctrl+Shift+[ and Ctrl+Shift+] navigation
10. **setupChatChangeListener()** - Detects URL changes when switching chats
11. **scanConversation()** - Finds all user messages and renders markers

### Marker Rendering Pipeline

The system processes user messages through the following stages:

USER MESSAGES
|
v
SCAN & FIND THEM
|
v
CALCULATE POSITIONS (percentage from top)
|
v
GROUP EVERY 10 MARKERS INTO CLUSTERS
|
v
CHECK IF INDIVIDUAL MARKERS FIT VERTICALLY
|
+-------------------+
|                   |
v                   v
YES                  NO
|                   |
v                   v
RENDER SINGLE      RE-CLUSTER MORE
MARKERS            AGGRESSIVELY
(every 5 markers)
|                   |
+-------------------+
|
v
DISPLAY ON PAGE
|
v
USER CLICKS MARKER
|
v
SCROLL TO MESSAGE


## Core Components

### State Management

- **sections[]** - Array of conversation sections (user prompts + responses)
- **markers[]** - Array of rendered marker elements with positions
- **isVisible** - Boolean for minimap visibility state
- **scrollContainer** - Reference to the scrollable DOM element
#claude-minimap (container)
|
+-- .minimap-track
|
+-- .minimap-markers (container for individual markers/clusters)

### DOM Structure

### Marker Types

**Individual Marker**
- Displays first 25 characters of message
- Shows full text on hover
- Scrolls to message on click

**Cluster**
- Groups 10 consecutive markers
- Displays count badge
- Expands to show individual markers on click
- Closes on click-away or selecting a marker

## Key Features

### Clustering Logic

- Groups every 10 consecutive markers into clusters
- Individual markers (1-9) render separately
- If markers cannot fit vertically, re-clusters into groups of 5
- Prevents overflow beyond 95% of container height

### Collision Detection

Prevents overlapping markers by:
1. Sorting markers by vertical position
2. Checking each marker against previously placed markers
3. Adjusting position downward if collision detected
4. Triggering aggressive clustering if space runs out

### Dynamic Sizing

- Minimap height matches scroll container height
- Adopts container's top and bottom padding
- Recalculates dimensions on window resize

### Chat Navigation

- Detects URL changes via MutationObserver
- Clears previous markers when switching chats
- Re-scans conversation after 500ms delay

## Technical Stack

- **Language**: TypeScript (class-based, vanilla JS)
- **DOM Manipulation**: Native Web APIs
- **Storage**: Chrome Extension Storage API
- **Observers**: MutationObserver for DOM monitoring

## File Structure

/extension
content.ts          Main TypeScript source
content.js          Compiled JavaScript
styles.css          Minimap styling
manifest.json       Chrome extension configuration

## Known Issues

1. Label displays "x" instead of count after click-away close
2. Markers overlap when vertical space is insufficient
3. Clustering logic can be simplified
4. Unused response tracking code in sections

## Browser Compatibility

- Chrome/Chromium-based browsers
- Requires Manifest V3 support