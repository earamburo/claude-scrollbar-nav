# Testing Guide for Claude Minimap Navigator

## 🧪 Complete Testing Walkthrough

This guide shows you how to test every function in the extension using Chrome DevTools.

---

## 🚀 Initial Setup

### 1. Load the Extension

```bash
# If using TypeScript, compile first:
npx tsc content.ts --target ES2020 --lib ES2020,DOM

# Then in Chrome:
1. Go to chrome://extensions/
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select your extension folder
5. Note the extension ID (e.g., abcdefghijklmnopqrstuvwxyz)
```

### 2. Open Claude.ai

```
1. Navigate to https://claude.ai
2. Start or open a conversation
3. Right-click anywhere → "Inspect" (or press F12)
4. You should see the minimap on the right side
```

---

## 🔍 Testing in Chrome DevTools

### Opening the Console

**Method 1: DevTools Console**
- Press `F12` or `Ctrl+Shift+I` (Windows/Linux) / `Cmd+Option+I` (Mac)
- Click the "Console" tab

**Method 2: Quick Console**
- Press `Ctrl+Shift+J` (Windows/Linux) / `Cmd+Option+J` (Mac)

You should see logs like:
```
[Minimap] Initializing...
[Minimap] Finding scroll container...
[Minimap] Creating minimap UI...
```

---

## 📋 Testing Each Function

### 1. Test: Check if Minimap Loaded

**What it tests:** Initialization and instance creation

**In Console:**
```javascript
// Check if instance exists
window.claudeMinimap

// Should output: ClaudeMinimap {minimap: div#claude-minimap, ...}
```

**Expected Result:**
- You see an object (not `undefined`)
- The object has properties like `minimap`, `sections`, `markers`

**If it fails:**
- Check if the extension is enabled
- Refresh the page
- Check Console for error messages

---

### 2. Test: Get Current State

**What it tests:** State tracking and data structure

**In Console:**
```javascript
// View current state
window.claudeMinimap.getState()
```

**Expected Result:**
```javascript
{
  isVisible: true,
  isDragging: false,
  sectionsCount: 5,        // Number of prompts
  markersCount: 5,         // Should match sectionsCount
  sections: [
    {
      id: 0,
      promptText: "Hello, can you help me...",
      responsesCount: 1
    },
    // ... more sections
  ]
}
```

**What to check:**
- `sectionsCount` matches number of prompts you see
- Each section has a `promptText`
- `responsesCount` matches Claude's responses

---

### 3. Test: Force Scan

**What it tests:** Message detection and grouping logic

**In Console:**
```javascript
// Force a new scan
window.claudeMinimap.forceScan()

// Then check the results
window.claudeMinimap.getState()
```

**Expected Result:**
- Console shows: `[Minimap] Scanning conversation...`
- Console shows: `[Minimap] Found X potential messages`
- Console shows: `[Minimap] Grouped into Y sections`
- State updates with new section count

**Try this:**
1. Type a new message to Claude
2. Wait for response
3. Run `forceScan()` again
4. Section count should increase

---

### 4. Test: Inspect Sections Array

**What it tests:** Data structure and message parsing

**In Console:**
```javascript
// Get all sections
const state = window.claudeMinimap.getState()
console.table(state.sections)

// Look at a specific section
state.sections[0]

// See the actual DOM element
state.sections[0].element
```

**Expected Result:**
```javascript
{
  id: 0,
  promptText: "How do I sort an array?",
  responsesCount: 1
}
```

**What to check:**
- Each section has unique `id` (0, 1, 2...)
- `promptText` contains first ~100 chars of your prompt
- `responsesCount` matches number of Claude responses

---

### 5. Test: Inspect Markers

**What it tests:** Marker positioning and rendering

**In Console:**
```javascript
// Access markers directly (using private property)
// Note: TypeScript makes this harder, but for testing:
window.claudeMinimap.markers

// Or inspect in Elements tab:
document.querySelectorAll('.minimap-marker')
```

**Expected Result:**
- Array of marker objects
- Each has `element`, `section`, `positionPercent`

**Visual check:**
- Look at the minimap on the right
- Count the circular markers
- Should match number of sections

**Inspect a marker:**
```javascript
// Get first marker element
const marker = document.querySelector('.minimap-marker')
marker.style.top         // Should be a percentage (e.g., "15.3%")
marker.dataset.text      // Should contain prompt text
```

---

### 6. Test: Jump to Section

**What it tests:** Navigation and scroll behavior

**In Console:**
```javascript
// Jump to first section
window.claudeMinimap.jumpToSection(0)

// Jump to third section
window.claudeMinimap.jumpToSection(2)

// Jump to last section
const state = window.claudeMinimap.getState()
window.claudeMinimap.jumpToSection(state.sectionsCount - 1)
```

**Expected Result:**
- Page smoothly scrolls to that section
- Element flashes with purple highlight
- Console shows: `[Minimap] Jumped to section X`

**What to check:**
- Scroll is smooth (not instant jump)
- Correct message is centered in viewport
- Highlight effect appears and fades

---

### 7. Test: Position Calculation

**What it tests:** The math that positions markers

**In Console:**
```javascript
// Get scroll container
const container = document.scrollingElement || document.documentElement

// Get total height
container.scrollHeight    // Total scrollable height (e.g., 10000)

// Get visible height
container.clientHeight    // Visible window height (e.g., 800)

// Get current scroll position
container.scrollTop       // How far scrolled (e.g., 2500)

// Calculate where viewport should be
const viewportPercent = (container.scrollTop / container.scrollHeight) * 100
console.log(`Viewport should be at ${viewportPercent}%`)

// Check actual viewport position
const viewport = document.querySelector('.minimap-viewport')
viewport.style.top        // Should match calculated percentage
```

**Expected Result:**
- Math checks out: if scrolled 25% down page, viewport is at 25%

---

### 8. Test: Hover Tooltip

**What it tests:** Proximity detection and tooltip display

**Steps:**
1. Move mouse over minimap track
2. Hover near (not on) a marker
3. Tooltip should appear

**In Console (while hovering):**
```javascript
// Check if tooltip is visible
const tooltip = document.getElementById('minimap-tooltip')
tooltip.style.display     // Should be 'block'
tooltip.textContent       // Should show prompt text

// Check tooltip position
tooltip.style.left        // X position
tooltip.style.top         // Y position
```

**Expected Result:**
- Tooltip appears when within 5% of a marker
- Shows correct prompt text
- Positioned to left of cursor

---

### 9. Test: Keyboard Shortcuts

**What it tests:** Event listeners and keyboard handling

**Try these:**

**Ctrl+Shift+M (Toggle)**
```javascript
// Before pressing: check visibility
window.claudeMinimap.getState().isVisible  // true

// Press Ctrl+Shift+M

// After pressing: should toggle
window.claudeMinimap.getState().isVisible  // false

// Press again to restore
```

**Ctrl+Shift+N (Next Section)**
```javascript
// Check current scroll position
const before = document.scrollingElement.scrollTop

// Press Ctrl+Shift+N

// Check new position
const after = document.scrollingElement.scrollTop
console.log(`Scrolled from ${before} to ${after}`)
```

**Ctrl+Shift+P (Previous Section)**
- Similar to above, should scroll backwards

---

### 10. Test: MutationObserver

**What it tests:** Auto-detection of new messages

**Steps:**
1. Note current section count
```javascript
window.claudeMinimap.getState().sectionsCount  // e.g., 5
```

2. Type a new message to Claude and send it

3. Wait for Claude's response

4. Check section count again
```javascript
window.claudeMinimap.getState().sectionsCount  // e.g., 6
```

**Expected Result:**
- Section count increases by 1
- New marker appears on minimap
- Console shows: `[Minimap] Scanning conversation...`

**Check debouncing:**
```javascript
// While Claude is typing (streaming response), 
// the scanner should NOT fire repeatedly.
// It should wait 300ms of quiet before scanning.
```

---

### 11. Test: Drag Viewport

**What it tests:** Mouse event handling and scroll sync

**Steps:**
1. Click and hold on the viewport (purple rectangle)
2. Drag up and down
3. Page should scroll in sync

**In Console (while dragging):**
```javascript
// Check drag state
window.claudeMinimap.getState().isDragging  // true

// Release mouse

// Check again
window.claudeMinimap.getState().isDragging  // false
```

**Expected Result:**
- Page scrolls smoothly as you drag
- No text selection while dragging
- `isDragging` toggles correctly

---

### 12. Test: Click Track to Jump

**What it tests:** Click position calculation

**In Console:**
```javascript
// Get track element
const track = document.getElementById('minimap-track')

// Get its height
const rect = track.getBoundingClientRect()
rect.height  // e.g., 600

// Calculate: if you click halfway down (300px from top)
const clickPercent = 300 / 600  // 0.5 = 50%

// This should scroll to 50% of page
const scrollHeight = document.scrollingElement.scrollHeight
const targetScroll = scrollHeight * 0.5

console.log(`Clicking halfway should scroll to ${targetScroll}px`)

// Now actually click halfway down the track
// Then check:
document.scrollingElement.scrollTop  // Should be near targetScroll
```

---

### 13. Test: Storage Persistence

**What it tests:** Chrome storage API

**In Console:**
```javascript
// Hide minimap
window.claudeMinimap.toggleMinimap()

// Check what's saved
chrome.storage.local.get(['minimapVisible'], (data) => {
  console.log('Stored visibility:', data.minimapVisible)  // false
})

// Refresh page
location.reload()

// After reload, check state
window.claudeMinimap.getState().isVisible  // Should be false (remembered!)
```

**Expected Result:**
- Visibility preference persists across page reloads

---

### 14. Test: Error Handling

**What it tests:** Graceful degradation

**Try these edge cases:**

**Invalid section ID:**
```javascript
// Jump to non-existent section
window.claudeMinimap.jumpToSection(999)

// Should gracefully do nothing (no error)
```

**No sections yet:**
```javascript
// On a brand new conversation with no messages
window.claudeMinimap.getState()
// Should show sectionsCount: 0, no errors
```

**Rapid toggle:**
```javascript
// Toggle rapidly
for (let i = 0; i < 10; i++) {
  window.claudeMinimap.toggleMinimap()
}
// Should handle without breaking
```

---

## 🔬 Advanced Testing: Elements Tab

### Inspect Minimap Structure

1. Open DevTools → Elements tab
2. Press `Ctrl+F` to search
3. Search for: `claude-minimap`
4. Expand the tree

**You should see:**
```html
<div id="claude-minimap">
  <div class="minimap-track" id="minimap-track">
    <div class="minimap-viewport" style="top: 25%; height: 10%;"></div>
    <div class="minimap-markers">
      <div class="minimap-marker" style="top: 5%;" data-section-id="0">
        <div class="minimap-marker-label">1</div>
      </div>
      <div class="minimap-marker" style="top: 20%;" data-section-id="1">
        <div class="minimap-marker-label">2</div>
      </div>
      <!-- ... more markers -->
    </div>
  </div>
  <div class="minimap-tooltip" style="display: none;"></div>
  <div class="minimap-toggle">...</div>
</div>
```

### Live CSS Editing

1. Select `.minimap-track` in Elements
2. In Styles panel, edit CSS live:

```css
/* Try changing colors */
.minimap-track {
  background: red;  /* See it change instantly */
}

/* Try changing size */
.minimap-track {
  width: 150px;     /* Make wider */
}
```

---

## 🐛 Debugging Common Issues

### Issue: "window.claudeMinimap is undefined"

**Possible causes:**
- Extension not loaded
- JavaScript error during initialization
- Page loaded before extension injected

**Debug:**
```javascript
// Check if content script loaded at all
console.log('Extension loaded:', typeof ClaudeMinimap !== 'undefined')

// Check for errors
// Look for red error messages in Console
```

### Issue: No markers appear

**Debug:**
```javascript
// Check if sections were found
window.claudeMinimap.getState().sectionsCount

// If 0, force a scan
window.claudeMinimap.forceScan()

// Check console for "Found X potential messages"
// If X is 0, the selectors might not match Claude's DOM
```

### Issue: Clicking doesn't scroll

**Debug:**
```javascript
// Check if scroll container was found correctly
const container = document.scrollingElement
container.scrollHeight > container.clientHeight  // Should be true

// Try manually scrolling
container.scrollTo({ top: 1000, behavior: 'smooth' })
// If this works, the scroll logic is fine
// If not, there's a scrolling permission issue
```

---

## 📊 Performance Testing

### Measure Scan Time

```javascript
console.time('scan')
window.claudeMinimap.forceScan()
console.timeEnd('scan')
// Should be < 100ms for most conversations
```

### Memory Usage

```javascript
// In DevTools → Memory tab
// 1. Take a heap snapshot
// 2. Look for "ClaudeMinimap" in the snapshot
// 3. Check retained size (should be < 1MB)
```

### Event Listener Count

```javascript
// Check how many listeners are attached
getEventListeners(document)
getEventListeners(document.getElementById('minimap-track'))
```

---

## ✅ Testing Checklist

Copy this into a document and check off as you test:

```
□ Extension loads without errors
□ Minimap appears on page
□ window.claudeMinimap is accessible
□ getState() returns valid data
□ Sections count matches prompts
□ Markers appear in correct positions
□ Clicking marker scrolls to section
□ Clicking track jumps to position
□ Dragging viewport scrolls page
□ Hover shows tooltip
□ Ctrl+Shift+M toggles visibility
□ Ctrl+Shift+N jumps to next section
□ Ctrl+Shift+P jumps to previous
□ New messages auto-detected
□ Visibility preference persists
□ No console errors during normal use
□ Smooth scrolling works
□ Highlight flash effect works
□ Viewport position syncs correctly
□ Works with 1 message
□ Works with 50+ messages
```

---

## 🎓 Learning Exercise

**Build your mental model:**

1. **Read the code** - Start with `init()`, follow the flow
2. **Add console.logs** - Sprinkle logs everywhere to see execution
3. **Break things** - Comment out code, see what breaks
4. **Fix things** - Uncomment, understand why it's needed
5. **Modify** - Change values, see effects

**Example:**
```typescript
// In renderMarkers(), add:
console.log('About to render marker at', positionPercent, '%')

// Now run forceScan() and watch the console
// You'll see exactly where each marker is placed
```

---

This guide gives you the tools to thoroughly understand every part of the extension. Take your time, experiment, and don't be afraid to break things - that's how you learn!