# Minimap Architecture Deep Dive

## 🎯 Core Concept

The minimap creates a **spatial representation** of your conversation, similar to code editor minimaps. Each prompt becomes a clickable flag marker positioned proportionally to its location in the full conversation.

---

## 🏗️ Architecture Layers

### Layer 1: Position Calculation System

**The Challenge:**
Transform absolute pixel positions into percentage-based positions on a fixed-height minimap.

**The Solution:**
```javascript
// 1. Get element's absolute position in scroll container
const elementRect = element.getBoundingClientRect();
const containerRect = scrollContainer.getBoundingClientRect();
const elementTop = elementRect.top - containerRect.top + scrollContainer.scrollTop;

// 2. Calculate as percentage of total scroll height
const scrollHeight = scrollContainer.scrollHeight;
const positionPercent = (elementTop / scrollHeight) * 100;

// 3. Position marker at that percentage
marker.style.top = `${positionPercent}%`;
```

**Why This Works:**
- scrollHeight = Total scrollable height (e.g., 10,000px for long conversation)
- elementTop = Distance from top (e.g., 2,500px)
- positionPercent = 25% → marker appears 25% down the minimap
- As conversation grows, all markers rescale proportionally

---

### Layer 2: Viewport Synchronization

**The viewport indicator** shows where you currently are in the conversation.

```javascript
// Sync viewport to scroll position
const scrollTop = container.scrollTop;           // Current scroll position
const scrollHeight = container.scrollHeight;     // Total scrollable height
const clientHeight = container.clientHeight;     // Visible height

// Viewport position (top edge)
const viewportPercent = (scrollTop / scrollHeight) * 100;

// Viewport size (height)
const viewportHeight = (clientHeight / scrollHeight) * 100;

// Apply to viewport element
viewport.style.top = `${viewportPercent}%`;
viewport.style.height = `${viewportHeight}%`;
```

**Real-world Example:**
```
Total height:    10,000px
Visible height:   1,000px
Scroll position:  3,000px

Viewport top:    (3,000 / 10,000) * 100 = 30%
Viewport height: (1,000 / 10,000) * 100 = 10%

Result: Viewport is 10% tall, positioned at 30% down the minimap
```

---

### Layer 3: Bidirectional Navigation

The minimap supports both **reading** (scroll → minimap) and **writing** (minimap → scroll).

**Direction 1: Page Scroll → Minimap Update**
```javascript
scrollContainer.addEventListener('scroll', () => {
  if (isDragging) return; // Don't fight user's drag
  
  const scrollPercent = (scrollTop / scrollHeight) * 100;
  viewport.style.top = `${scrollPercent}%`;
});
```

**Direction 2: Minimap Click → Page Scroll**
```javascript
track.addEventListener('click', (e) => {
  const rect = track.getBoundingClientRect();
  const clickY = e.clientY - rect.top;
  const clickPercent = clickY / rect.height;
  
  const targetScroll = scrollHeight * clickPercent;
  container.scrollTo({ top: targetScroll, behavior: 'smooth' });
});
```

**Direction 3: Viewport Drag → Page Scroll**
```javascript
// On drag
const mousePercent = mouseY / trackHeight;
const targetScroll = scrollHeight * mousePercent;
container.scrollTop = targetScroll; // Instant, no smooth
```

---

### Layer 4: Marker Rendering Pipeline

**Step 1: Scan Conversation**
```javascript
scanConversation() {
  // Find all message elements
  const allMessages = findAllMessages();
  
  // Group into sections (user prompt + responses)
  const sections = groupIntoSections(allMessages);
  
  // Store sections
  this.sections = sections;
  
  // Render markers
  this.renderMarkers();
}
```

**Step 2: Calculate Positions**
```javascript
renderMarkers() {
  sections.forEach((section, idx) => {
    const element = section.prompt.element;
    
    // Get absolute position
    const elementTop = getElementScrollTop(element);
    
    // Convert to percentage
    const positionPercent = (elementTop / scrollHeight) * 100;
    
    // Create marker at that position
    createMarker(positionPercent, idx, section);
  });
}
```

**Step 3: Create Interactive Marker**
```javascript
createMarker(positionPercent, idx, section) {
  const marker = document.createElement('div');
  marker.className = 'minimap-marker';
  marker.style.top = `${positionPercent}%`;
  
  // Add label
  marker.innerHTML = `<div class="minimap-marker-label">${idx + 1}</div>`;
  
  // Add click handler
  marker.addEventListener('click', () => {
    section.prompt.element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  });
  
  return marker;
}
```

---

### Layer 5: Hover Tooltip System

**Challenge:** Show prompt text when hovering near markers (not just on them).

**Solution:** Proximity detection

```javascript
handleHover(e) {
  // Get mouse position as percentage
  const mouseY = e.clientY - trackRect.top;
  const hoverPercent = (mouseY / trackRect.height) * 100;
  
  // Find nearest marker within 5% range
  let nearestMarker = null;
  let nearestDistance = Infinity;
  
  this.markers.forEach(marker => {
    const distance = Math.abs(marker.positionPercent - hoverPercent);
    
    if (distance < 5 && distance < nearestDistance) {
      nearestDistance = distance;
      nearestMarker = marker;
    }
  });
  
  if (nearestMarker) {
    showTooltip(nearestMarker.section.prompt.text);
  }
}
```

**Why 5% Range?**
- Too small (1%): Hard to trigger, frustrating
- Too large (10%): Ambiguous which marker you're hovering
- 5%: Sweet spot for usability

---

### Layer 6: Drag-to-Scroll Mechanism

**The Flow:**
```javascript
// 1. Mouse down on viewport
viewport.addEventListener('mousedown', (e) => {
  this.isDragging = true;
  document.body.style.userSelect = 'none'; // Prevent text selection
});

// 2. Mouse move anywhere
document.addEventListener('mousemove', (e) => {
  if (!this.isDragging) return;
  
  // Calculate scroll position from mouse Y
  const trackRect = track.getBoundingClientRect();
  const mouseY = e.clientY - trackRect.top;
  const percent = Math.max(0, Math.min(1, mouseY / trackRect.height));
  
  // Apply instantly (no smooth scroll during drag)
  scrollContainer.scrollTop = scrollHeight * percent;
});

// 3. Mouse up anywhere
document.addEventListener('mouseup', () => {
  this.isDragging = false;
  document.body.style.userSelect = '';
});
```

**Why Three Separate Listeners?**
- `mousedown` on viewport: Start drag only when clicking viewport
- `mousemove` on document: Track movement even if cursor leaves viewport
- `mouseup` on document: Stop drag even if released outside viewport

---

## 🎨 Visual Design Architecture

### Z-Index Layering
```
Layer 4: Tooltip         (z-index: 1000000)
Layer 3: Hovered Marker  (z-index: 10)
Layer 2: Viewport        (z-index: 2)
Layer 1: Markers         (z-index: 1)
Layer 0: Track           (z-index: 0)
```

### CSS Transform Strategy

**Why transforms over top/left?**
```css
/* BAD - causes reflow */
.marker {
  top: 50%;
  left: 10px;
}

/* GOOD - GPU accelerated */
.marker {
  top: 50%;
  transform: translateY(-50%);
}
```

Transforms are:
- Handled by GPU
- Don't trigger layout recalculation
- Smoother animations

### Color Cycling Algorithm

```css
/* Every 5th marker gets a different gradient */
.minimap-marker:nth-child(5n+1) { background: gradient1; }
.minimap-marker:nth-child(5n+2) { background: gradient2; }
.minimap-marker:nth-child(5n+3) { background: gradient3; }
.minimap-marker:nth-child(5n+4) { background: gradient4; }
.minimap-marker:nth-child(5n+5) { background: gradient5; }
```

**Result:** Visual variety without manual color assignment

---

## ⚡ Performance Optimizations

### 1. Debounced Scanning
```javascript
// Don't scan on every DOM mutation
observer.observe(body, { childList: true, subtree: true });

// Instead, debounce to wait for quiet period
if (shouldScan) {
  clearTimeout(this.scanTimeout);
  this.scanTimeout = setTimeout(() => scan(), 300);
}
```

### 2. Passive Scroll Listeners
```javascript
container.addEventListener('scroll', updateViewport, {
  passive: true // Tell browser we won't prevent default
});
```

Browser can optimize scrolling knowing we won't block it.

### 3. Conditional Viewport Updates
```javascript
const updateViewport = () => {
  if (this.isDragging) return; // Skip during drag
  
  // Calculate and apply...
};
```

Prevents fighting between drag handler and scroll listener.

### 4. RequestAnimationFrame for Smooth Updates
```javascript
handleDrag(e) {
  if (!this.isDragging) return;
  
  requestAnimationFrame(() => {
    // Update scroll position
    // Ensures updates happen at 60fps
  });
}
```

---

## 🔄 Complete Interaction Flow

### Scenario: User Scrolls Down

```
1. User scrolls page
   ↓
2. Scroll event fires
   ↓
3. updateViewport() called
   ↓
4. Calculate viewport position:
   - scrollTop = 5000px
   - scrollHeight = 10000px
   - position = 50%
   ↓
5. Update viewport CSS:
   viewport.style.top = "50%"
   ↓
6. Browser repaints minimap (GPU accelerated)
```

### Scenario: User Clicks Marker

```
1. User clicks marker #3
   ↓
2. Click event fires
   ↓
3. Prevent event from bubbling to track
   e.stopPropagation()
   ↓
4. Get section from data
   section = sections[3]
   ↓
5. Scroll to element
   element.scrollIntoView({ smooth, center })
   ↓
6. Browser smooth scrolls
   ↓
7. Scroll events fire during animation
   ↓
8. Viewport follows scroll (feedback loop)
   ↓
9. Highlight element with flash effect
```

### Scenario: User Drags Viewport

```
1. User clicks viewport
   ↓
2. mousedown event fires
   isDragging = true
   ↓
3. User moves mouse
   ↓
4. mousemove events fire continuously
   ↓
5. For each mousemove:
   - Calculate mouse position percentage
   - Convert to scroll position
   - Set scrollTop directly (no animation)
   ↓
6. Scroll events fire
   BUT updateViewport() returns early
   (isDragging is true)
   ↓
7. User releases mouse
   ↓
8. mouseup event fires
   isDragging = false
   ↓
9. Resume normal viewport sync
```

---

## 🐛 Edge Cases Handled

### 1. Rapid Conversation Growth
**Problem:** User types rapidly, DOM changes constantly
**Solution:** Debounce scanning (300ms quiet period required)

### 2. Initial Page Load
**Problem:** Content still loading when script runs
**Solution:** Delayed initialization (1000ms after script load)

### 3. Dynamic Content Height
**Problem:** Images/code blocks load after initial scan
**Solution:** MutationObserver catches these changes, triggers rescan

### 4. Viewport Smaller Than Track
**Problem:** Very short conversations make tiny viewport
**Solution:** `min-height: 2%` enforced in CSS

### 5. Scroll Container Detection
**Problem:** Claude.ai might change which element scrolls
**Solution:** Search for overflow containers, fallback to documentElement

---

## 📊 Data Structures

### Sections Array
```javascript
sections = [
  {
    id: 0,
    prompt: {
      text: "How do I sort an array?",
      element: <DOM Reference>
    },
    responses: [
      {
        text: "You can use array.sort()...",
        element: <DOM Reference>
      }
    ]
  },
  // ... more sections
]
```

### Markers Array
```javascript
markers = [
  {
    element: <marker DOM node>,
    section: <reference to section>,
    positionPercent: 15.3
  },
  // ... more markers
]
```

---

## 🎯 Key Design Decisions

### Why Percentage-Based Positioning?
- **Responsive:** Works at any minimap height
- **Scalable:** Handles conversations from 10 to 1000 messages
- **Simple:** No complex recalculation needed

### Why Separate Viewport and Markers?
- **Visual Clarity:** Viewport shows "you are here", markers show "sections are here"
- **Interaction:** Can drag viewport without clicking markers
- **Z-Index:** Viewport above markers for proper layering

### Why Real-Time Sync?
- **Immediate Feedback:** User sees position update instantly
- **Spatial Awareness:** Always know where you are in conversation
- **Navigation Aid:** Minimap becomes a navigation tool, not just decoration

---

This minimap architecture creates a **spatial navigation interface** that maps physical scroll position to visual position, enabling instant jumps through long conversations without losing context.