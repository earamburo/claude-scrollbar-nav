# Claude Minimap Navigator

A Chrome extension that adds a visual minimap scrollbar with clickable flag markers to Claude.ai conversations, enabling instant navigation through long chat histories.

![Minimap Preview](preview.png)

## ✨ Features

- 🗺️ **Visual Minimap** - See your entire conversation at a glance with a scrollbar-style minimap
- 🎯 **Flag Markers** - Each prompt appears as a colored flag on the minimap
- 👆 **Click to Jump** - Click any flag or anywhere on the minimap to instantly jump there
- 🖱️ **Drag to Scroll** - Drag the viewport indicator for smooth scrolling
- 💬 **Hover Tooltips** - Hover near flags to preview the prompt text
- ⌨️ **Keyboard Navigation** - Jump between sections with keyboard shortcuts
- 🎨 **Color-Coded** - Different gradient colors for visual variety
- 🔄 **Auto-Update** - Tracks new messages as your conversation grows
- 💾 **State Persistence** - Remembers if you've hidden the minimap

## 🚀 Installation

### Chrome Extension

1. Download/clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the `claude-navigator-minimap` folder
6. Visit claude.ai - the minimap appears on the right side!

## 📖 Usage

### Visual Navigation

**Minimap Components:**
- **Track** - The tall bar showing the entire conversation
- **Viewport** - The highlighted area showing where you currently are
- **Flags** - Circular markers indicating each prompt location
- **Numbers** - Each flag is numbered sequentially

### Interactions

**Click Navigation:**
- Click a flag → Jump to that section
- Click the track → Jump to that position
- Click viewport → Begin dragging

**Drag Navigation:**
- Click and hold the viewport indicator
- Drag up/down to scroll through conversation
- Release to stop

**Hover Preview:**
- Hover near a flag to see tooltip
- Tooltip shows first ~100 characters of the prompt

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+M` | Toggle minimap visibility |
| `Ctrl+Shift+N` | Jump to next section |
| `Ctrl+Shift+P` | Jump to previous section |

### Toggle Button

Click the icon button below the minimap to hide/show it.

## 🏗️ Architecture

### How It Works

```
┌─────────────────────────────────────────────┐
│           Claude.ai Conversation            │
│  ┌───────────────────────────────────────┐  │
│  │  User Message 1                       │  │ ◄─┐
│  │  Claude Response 1                    │  │   │
│  ├───────────────────────────────────────┤  │   │
│  │  User Message 2                       │  │ ◄─┤  Minimap
│  │  Claude Response 2                    │  │   │  Track
│  ├───────────────────────────────────────┤  │   │  with
│  │  User Message 3                       │  │ ◄─┤  Markers
│  │  Claude Response 3                    │  │   │
│  └───────────────────────────────────────┘  │ ◄─┘
└─────────────────────────────────────────────┘
```

### Component Breakdown

**1. MutationObserver**
- Watches DOM for new messages
- Debounced to avoid excessive scanning
- Triggers re-render when conversation updates

**2. Scroll Synchronization**
- Listens to scroll events on main page
- Updates viewport position in minimap
- Bidirectional sync (page ↔ minimap)

**3. Position Calculation**
```javascript
// For each message, calculate its position
const elementTop = element.getBoundingClientRect().top;
const scrollHeight = document.scrollHeight;
const positionPercent = (elementTop / scrollHeight) * 100;

// Place marker at that percentage
marker.style.top = `${positionPercent}%`;
```

**4. Jump Navigation**
```javascript
// When user clicks a marker
element.scrollIntoView({
  behavior: 'smooth',
  block: 'center'
});
```

## 🎨 Customization

### Adjust Minimap Size

In `styles.css`:
```css
.minimap-track {
  width: 80px;        /* Change width */
  height: 70vh;       /* Change height */
  max-height: 600px;  /* Max height */
}
```

### Change Marker Colors

The markers cycle through 5 gradient colors. Edit in `styles.css`:
```css
.minimap-marker:nth-child(5n+1) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
/* Add more color variants... */
```

### Modify Position

Move minimap to left side:
```css
#claude-minimap {
  right: auto;
  left: 16px;
}
```

### Adjust Marker Size

```css
.minimap-marker {
  width: 24px;   /* Marker size */
  height: 24px;
}
```

## 🔧 Development

### Project Structure
```
claude-navigator-minimap/
├── manifest.json       # Extension config
├── content.js          # Main logic
├── styles.css          # Visual styling
├── popup.html          # Extension popup
└── README.md           # This file
```

### Testing Locally

1. Make changes to files
2. Go to `chrome://extensions/`
3. Click reload icon on extension
4. Refresh claude.ai

### Debugging

Enable console logging in `content.js`:
```javascript
// Add at top of file
const DEBUG = true;
const log = (...args) => DEBUG && console.log('[Minimap]', ...args);

// Use throughout code
scanConversation() {
  log('Scanning conversation...');
  log(`Found ${this.sections.length} sections`);
}
```

## 📊 Performance

- **Memory**: ~500KB for typical 100-message conversation
- **CPU**: Minimal - event-driven, not polling
- **Render**: 60fps animations with CSS transforms
- **Debounce**: 300ms delay prevents scan spam during typing

## 🐛 Troubleshooting

**Minimap doesn't appear:**
- Refresh the page
- Try `Ctrl+Shift+M` to toggle
- Check browser console for errors

**Markers in wrong positions:**
- Scroll up/down slightly to trigger recalculation
- Use `Ctrl+Shift+M` twice to force refresh

**Clicking doesn't jump:**
- Make sure you're clicking markers, not between them
- Try clicking the track itself to jump

## 🔮 Future Enhancements

Potential features for v2:
- [ ] Search filter to highlight matching sections
- [ ] Bookmarking favorite responses
- [ ] Export conversation outline
- [ ] Section thumbnails on hover
- [ ] Customizable marker icons
- [ ] Dark/light theme toggle
- [ ] Resizable minimap
- [ ] Minimap position toggle (left/right)
- [ ] Show code blocks as special markers
- [ ] Time-based color coding

## 🆚 Comparison to Sidebar Version

| Feature | Minimap | Sidebar |
|---------|---------|---------|
| Screen space | Minimal (80px) | Large (340px) |
| Visual overview | ✅ Instant | ❌ Requires scrolling |
| Click target size | Medium | Large |
| Text preview | Hover tooltip | Always visible |
| Collapse/expand | N/A | Yes |
| Best for | Quick jumps | Detailed browsing |

**Use Minimap if:**
- You want minimal UI footprint
- You navigate by visual position
- You have many (50+) sections

**Use Sidebar if:**
- You want to read prompt text
- You prefer hierarchical structure
- You have fewer (<30) sections

## 📄 License

MIT License - free to use and modify.

## 🙏 Credits

Inspired by code editor minimaps (VS Code, Sublime Text) and applied to conversational AI interfaces.

## 📝 Changelog

### v1.0.0 (2026-03-26)
- Initial release
- Visual minimap scrollbar
- Clickable flag markers
- Drag-to-scroll viewport
- Hover tooltips
- Keyboard shortcuts
- Auto-updating
- Color-coded markers