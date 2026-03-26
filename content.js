// Claude Chat Minimap Navigator
// Visual scrollbar with clickable markers for conversation navigation

class ClaudeMinimap {
  constructor() {
    this.minimap = null;
    this.markers = [];
    this.sections = [];
    this.observer = null;
    this.scrollContainer = null;
    this.isDragging = false;
    this.isVisible = true;
    
    this.init();
  }

  async init() {
    // Load saved state
    const saved = await chrome.storage.local.get(['minimapVisible']);
    if (saved.minimapVisible !== undefined) {
      this.isVisible = saved.minimapVisible;
    }

    // Wait for page to be ready
    setTimeout(() => {
      this.findScrollContainer();
      this.createMinimap();
      this.startObserving();
      this.setupScrollSync();
      this.setupKeyboardShortcuts();
      this.scanConversation();
    }, 1000);
  }

  findScrollContainer() {
    // Find the main scrollable container on claude.ai
    // Usually the main content area or body
    this.scrollContainer = document.documentElement || document.body;
    
    // Try to find a more specific scroll container
    const containers = document.querySelectorAll('[class*="scroll"], [style*="overflow"]');
    for (const container of containers) {
      const style = window.getComputedStyle(container);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        if (container.scrollHeight > container.clientHeight) {
          this.scrollContainer = container;
          break;
        }
      }
    }
  }

  createMinimap() {
    // Remove existing if present
    const existing = document.getElementById('claude-minimap');
    if (existing) existing.remove();

    this.minimap = document.createElement('div');
    this.minimap.id = 'claude-minimap';
    this.minimap.className = this.isVisible ? '' : 'hidden';
    
    this.minimap.innerHTML = `
      <div class="minimap-track" id="minimap-track">
        <div class="minimap-viewport" id="minimap-viewport"></div>
        <div class="minimap-markers" id="minimap-markers"></div>
      </div>
      <div class="minimap-tooltip" id="minimap-tooltip"></div>
      <div class="minimap-toggle" id="minimap-toggle" title="Toggle minimap (Ctrl+Shift+M)">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2h3v12H2V2zm5 0h3v12H7V2zm5 0h2v12h-2V2z"/>
        </svg>
      </div>
    `;

    document.body.appendChild(this.minimap);

    // Setup event listeners
    const track = document.getElementById('minimap-track');
    const viewport = document.getElementById('minimap-viewport');
    const toggle = document.getElementById('minimap-toggle');

    // Click to jump
    track.addEventListener('click', (e) => this.handleTrackClick(e));
    
    // Drag viewport
    viewport.addEventListener('mousedown', (e) => this.startDrag(e));
    document.addEventListener('mousemove', (e) => this.handleDrag(e));
    document.addEventListener('mouseup', () => this.stopDrag());
    
    // Hover for tooltip
    track.addEventListener('mousemove', (e) => this.handleHover(e));
    track.addEventListener('mouseleave', () => this.hideTooltip());
    
    // Toggle button
    toggle.addEventListener('click', () => this.toggleMinimap());
  }

  setupScrollSync() {
    // Update viewport position when user scrolls
    const updateViewport = () => {
      if (this.isDragging) return; // Don't update during drag
      
      const scrollTop = this.scrollContainer.scrollTop;
      const scrollHeight = this.scrollContainer.scrollHeight;
      const clientHeight = this.scrollContainer.clientHeight;
      
      const viewportPercent = (scrollTop / scrollHeight) * 100;
      const viewportHeight = (clientHeight / scrollHeight) * 100;
      
      const viewport = document.getElementById('minimap-viewport');
      if (viewport) {
        viewport.style.top = `${viewportPercent}%`;
        viewport.style.height = `${Math.max(viewportHeight, 2)}%`; // Min 2%
      }
    };

    // Listen to scroll events
    this.scrollContainer.addEventListener('scroll', updateViewport, { passive: true });
    window.addEventListener('resize', updateViewport);
    
    // Initial update
    setTimeout(updateViewport, 100);
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+M - Toggle minimap
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        this.toggleMinimap();
      }
      
      // Ctrl+Shift+N - Next section
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        this.jumpToNextSection();
      }
      
      // Ctrl+Shift+P - Previous section
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        this.jumpToPreviousSection();
      }
    });
  }

  toggleMinimap() {
    this.isVisible = !this.isVisible;
    this.minimap.classList.toggle('hidden');
    chrome.storage.local.set({ minimapVisible: this.isVisible });
  }

  startObserving() {
    this.observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1 && this.isMessageNode(node)) {
              shouldScan = true;
              break;
            }
          }
        }
      }
      
      if (shouldScan) {
        clearTimeout(this.scanTimeout);
        this.scanTimeout = setTimeout(() => this.scanConversation(), 300);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  isMessageNode(node) {
    if (!node.querySelector) return false;
    const text = node.textContent || '';
    return text.length > 20;
  }

  scanConversation() {
    // Find all message elements
    const allMessages = Array.from(document.querySelectorAll('div')).filter(div => {
      const text = div.textContent;
      if (!text || text.length < 20) return false;
      
      const hasUserIndicator = div.querySelector('[data-testid*="user"]') || 
                                div.classList.toString().includes('user');
      const hasAssistantIndicator = div.querySelector('[data-testid*="assistant"]') ||
                                     div.classList.toString().includes('claude') ||
                                     div.classList.toString().includes('assistant');
      
      return hasUserIndicator || hasAssistantIndicator;
    });

    // Group into sections (user prompt + responses)
    const newSections = [];
    let currentSection = null;

    allMessages.forEach(msg => {
      const text = this.extractText(msg);
      if (text.length < 10) return;

      const isUser = this.isUserMessage(msg);

      if (isUser) {
        currentSection = {
          id: newSections.length,
          prompt: { text, element: msg },
          responses: []
        };
        newSections.push(currentSection);
      } else if (currentSection) {
        currentSection.responses.push({ text, element: msg });
      }
    });

    // Update if changed
    if (this.sectionsChanged(newSections)) {
      this.sections = newSections;
      this.renderMarkers();
    }
  }

  extractText(element) {
    let text = element.textContent || '';
    text = text.trim().replace(/\s+/g, ' ');
    return text.substring(0, 100);
  }

  isUserMessage(element) {
    const html = element.innerHTML.toLowerCase();
    const className = element.className.toLowerCase();
    
    return html.includes('user') || 
           className.includes('user') ||
           element.querySelector('[data-testid*="user"]') !== null;
  }

  sectionsChanged(newSections) {
    if (newSections.length !== this.sections.length) return true;
    
    if (newSections.length > 0 && this.sections.length > 0) {
      const lastNew = newSections[newSections.length - 1];
      const lastOld = this.sections[this.sections.length - 1];
      
      return lastNew.prompt.text !== lastOld.prompt.text ||
             lastNew.responses.length !== lastOld.responses.length;
    }
    
    return false;
  }

  renderMarkers() {
    const markersContainer = document.getElementById('minimap-markers');
    if (!markersContainer) return;

    markersContainer.innerHTML = '';
    this.markers = [];

    const scrollHeight = this.scrollContainer.scrollHeight;

    this.sections.forEach((section, idx) => {
      // Calculate position as percentage of total scroll height
      const elementTop = this.getElementScrollTop(section.prompt.element);
      const positionPercent = (elementTop / scrollHeight) * 100;

      // Create marker
      const marker = document.createElement('div');
      marker.className = 'minimap-marker';
      marker.style.top = `${positionPercent}%`;
      marker.setAttribute('data-section-id', idx);
      marker.setAttribute('data-text', section.prompt.text);

      // Add number label
      const label = document.createElement('div');
      label.className = 'minimap-marker-label';
      label.textContent = idx + 1;
      marker.appendChild(label);

      // Click handler
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        this.jumpToSection(idx);
      });

      markersContainer.appendChild(marker);
      this.markers.push({ element: marker, section, positionPercent });
    });
  }

  getElementScrollTop(element) {
    // Get element's position relative to scroll container
    const elementRect = element.getBoundingClientRect();
    const containerRect = this.scrollContainer.getBoundingClientRect();
    
    return elementRect.top - containerRect.top + this.scrollContainer.scrollTop;
  }

  handleTrackClick(e) {
    if (e.target.classList.contains('minimap-marker') || 
        e.target.classList.contains('minimap-marker-label')) {
      return; // Marker click handled separately
    }

    const track = document.getElementById('minimap-track');
    const rect = track.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const clickPercent = clickY / rect.height;

    const scrollHeight = this.scrollContainer.scrollHeight;
    const targetScroll = scrollHeight * clickPercent;

    this.scrollContainer.scrollTo({
      top: targetScroll,
      behavior: 'smooth'
    });
  }

  startDrag(e) {
    e.preventDefault();
    this.isDragging = true;
    document.body.style.userSelect = 'none';
  }

  handleDrag(e) {
    if (!this.isDragging) return;

    const track = document.getElementById('minimap-track');
    const rect = track.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const percent = Math.max(0, Math.min(1, mouseY / rect.height));

    const scrollHeight = this.scrollContainer.scrollHeight;
    const targetScroll = scrollHeight * percent;

    this.scrollContainer.scrollTop = targetScroll;
  }

  stopDrag() {
    this.isDragging = false;
    document.body.style.userSelect = '';
  }

  handleHover(e) {
    // Find nearest marker
    const track = document.getElementById('minimap-track');
    const rect = track.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const hoverPercent = (mouseY / rect.height) * 100;

    let nearestMarker = null;
    let nearestDistance = Infinity;

    this.markers.forEach(marker => {
      const distance = Math.abs(marker.positionPercent - hoverPercent);
      if (distance < nearestDistance && distance < 5) { // Within 5% range
        nearestDistance = distance;
        nearestMarker = marker;
      }
    });

    if (nearestMarker) {
      this.showTooltip(e.clientX, e.clientY, nearestMarker.section.prompt.text);
    } else {
      this.hideTooltip();
    }
  }

  showTooltip(x, y, text) {
    const tooltip = document.getElementById('minimap-tooltip');
    if (!tooltip) return;

    tooltip.textContent = text;
    tooltip.style.display = 'block';
    tooltip.style.left = `${x - tooltip.offsetWidth - 20}px`;
    tooltip.style.top = `${y - tooltip.offsetHeight / 2}px`;
  }

  hideTooltip() {
    const tooltip = document.getElementById('minimap-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }

  jumpToSection(sectionId) {
    if (sectionId < 0 || sectionId >= this.sections.length) return;

    const section = this.sections[sectionId];
    section.prompt.element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    // Flash highlight
    this.highlightElement(section.prompt.element);
  }

  jumpToNextSection() {
    const currentScroll = this.scrollContainer.scrollTop;
    
    // Find first section below current scroll position
    for (let i = 0; i < this.sections.length; i++) {
      const elementTop = this.getElementScrollTop(this.sections[i].prompt.element);
      if (elementTop > currentScroll + 50) { // 50px buffer
        this.jumpToSection(i);
        return;
      }
    }
  }

  jumpToPreviousSection() {
    const currentScroll = this.scrollContainer.scrollTop;
    
    // Find last section above current scroll position
    for (let i = this.sections.length - 1; i >= 0; i--) {
      const elementTop = this.getElementScrollTop(this.sections[i].prompt.element);
      if (elementTop < currentScroll - 50) { // 50px buffer
        this.jumpToSection(i);
        return;
      }
    }
  }

  highlightElement(element) {
    element.style.transition = 'background-color 0.3s';
    element.style.backgroundColor = 'rgba(139, 92, 246, 0.15)';
    setTimeout(() => {
      element.style.backgroundColor = '';
    }, 800);
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ClaudeMinimap();
  });
} else {
  new ClaudeMinimap();
}