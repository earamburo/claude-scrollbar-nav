/**
 * Claude Minimap Navigator - TypeScript Version
 * Visual scrollbar with clickable markers for conversation navigation
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Section {
  id: number;
  prompt: MessageData;
  responses: MessageData[];
}

interface MessageData {
  text: string;
  element: HTMLElement;
}

interface MarkerData {
  element: HTMLDivElement;
  section: Section;
  positionPercent: number;
}

interface StorageData {
  minimapVisible?: boolean;
}

// ============================================================================
// MAIN CLASS
// ============================================================================

class ClaudeMinimap {
  // DOM Elements
  private minimap: HTMLDivElement | null = null;
  private scrollContainer: HTMLElement | Document = document.documentElement;

  // State
  private markers: MarkerData[] = [];
  private sections: Section[] = [];
  private isDragging: boolean = false;
  private isVisible: boolean = true;

  // Observers & Timeouts
  private observer: MutationObserver | null = null;
  private scanTimeout: number | null = null;

  constructor() {
    this.init();
  }

  /**
   * Initialize the minimap
   * This is the entry point - called when the class is instantiated
   */
  private async init(): Promise<void> {
    console.log('Scroll Minimap Initializing...');

    // Load saved state from Chrome storage
    await this.loadSavedState();

    // Wait for page to be fully ready
    setTimeout(() => {
      this.findScrollContainer();
      this.createMinimap();
      this.startObserving();
      this.setupScrollSync();
      this.setupKeyboardShortcuts();
      this.scanConversation();

      console.log('Initialization complete');
    }, 1000);
  }

  /**
   * Load saved state from Chrome storage, to see if minimap is visible or not
   */
  private async loadSavedState(): Promise<void> {
    try {
      const saved = await chrome.storage.local.get(['minimapVisible']) as StorageData;

      if (saved.minimapVisible !== undefined) {
        this.isVisible = saved.minimapVisible;
        console.log('[Minimap] Loaded visibility state:', this.isVisible);
      }
    } catch (error) {
      console.error('[Minimap] Error loading state:', error);
    }
  }

  /**
   * Find the main scrollable container on the page
   * Claude.ai's structure can vary, so we search for it
   */
  private findScrollContainer(): void {
    console.log('Finding scroll container...');

    // Default to document
    this.scrollContainer = document.documentElement;

    // Try to find a more specific scroll container
    const containers = document.querySelectorAll('[class*="scroll"], [style*="overflow"]');

    for (const container of Array.from(containers)) {
      const htmlContainer = container as HTMLElement;
      const style = window.getComputedStyle(htmlContainer);

      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        if (htmlContainer.scrollHeight > htmlContainer.clientHeight) {
          this.scrollContainer = htmlContainer;
          console.log('[Minimap] Found scroll container:', htmlContainer);
          break;
        }
      }
    }
  }

  /**
   * Create the minimap DOM structure and inject it into the page
   */
  private createMinimap(): void {
    console.log('[Minimap] Creating minimap UI...');

    // Remove existing if present
    const existing = document.getElementById('claude-minimap');
    if (existing) {
      existing.remove();
    }

    // Create main container
    this.minimap = document.createElement('div');
    this.minimap.id = 'claude-minimap';
    this.minimap.className = this.isVisible ? '' : 'hidden';

    // Build HTML structure
    this.minimap.innerHTML = `
      <div class="minimap-track" id="minimap-track">
        <div class="minimap-markers" id="minimap-markers"></div>
      </div>
      <div class="minimap-tooltip" id="minimap-tooltip"></div>
    `;


    document.body.appendChild(this.minimap);
    console.log('[Minimap] Minimap UI created');

    // Setup event listeners
    this.attachEventListeners();

    document.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.minimap-cluster')) {
        this.closeAllClusters();
      }
    })


  }

  /**
   * Attach all event listeners to minimap elements
   */
  private attachEventListeners(): void {
    const track = document.getElementById('minimap-track');

    if (!track) {
      console.error('[Minimap] Track element not found');
      return;
    }

    // Click to jump
    track.addEventListener('click', (e) => this.handleTrackClick(e));

    // Hover for tooltip
    track.addEventListener('mousemove', (e) => this.handleHover(e));
    track.addEventListener('mouseleave', () => this.hideTooltip());

    console.log('[Minimap] Event listeners attached');
  }

  /**
   * Set up scroll synchronization between page and minimap
   */
  private setupScrollSync(): void {
    const updateViewport = (): void => {
      if (this.isDragging) return; // Don't update during drag

      const container = this.scrollContainer as HTMLElement;
      const scrollTop = container.scrollTop || 0;
      const scrollHeight = container.scrollHeight || 1;
      const clientHeight = container.clientHeight || 1;

      // Calculate viewport position and height as percentages
      const viewportPercent = (scrollTop / scrollHeight) * 100;
      const viewportHeight = (clientHeight / scrollHeight) * 100;

      const viewport = document.getElementById('minimap-viewport');
      if (viewport) {
        viewport.style.top = `${viewportPercent}%`;
        viewport.style.height = `${Math.max(viewportHeight, 2)}%`; // Min 2%
      }
    };

    // Listen to scroll events
    const scrollElement = this.scrollContainer as HTMLElement;
    scrollElement.addEventListener('scroll', updateViewport, { passive: true });
    window.addEventListener('resize', updateViewport);

    // Initial update
    setTimeout(updateViewport, 100);

    console.log('[Minimap] Scroll sync set up');
  }

  /**
   * Set up keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      // Ctrl+Shift+M - Toggle minimap
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        this.toggleMinimap();
      }

      // Ctrl+Shift+N - Next section
      if (e.ctrlKey && e.shiftKey && e.key === '}') {
        e.preventDefault();
        this.jumpToNextSection();
      }

      // Ctrl+Shift+P - Previous section
      if (e.ctrlKey && e.shiftKey && e.key === '{') {
        e.preventDefault();
        this.jumpToPreviousSection();
      }
    });

    console.log('[Minimap] Keyboard shortcuts set up');
  }

  /**
   * Toggle minimap visibility
   */
  private toggleMinimap(): void {
    this.isVisible = !this.isVisible;
    this.minimap?.classList.toggle('hidden');

    chrome.storage.local.set({ minimapVisible: this.isVisible });
    console.log('[Minimap] Visibility toggled:', this.isVisible);
  }

  /**
   * Start observing DOM changes with MutationObserver
   */
  private startObserving(): void {
    this.observer = new MutationObserver((mutations: MutationRecord[]) => {
      let shouldScan = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node.nodeType === 1 && this.isMessageNode(node as HTMLElement)) {
              shouldScan = true;
              break;
            }
          }
        }
      }

      if (shouldScan) {
        // Debounce: wait 300ms of quiet before scanning
        if (this.scanTimeout) {
          clearTimeout(this.scanTimeout);
        }
        this.scanTimeout = window.setTimeout(() => this.scanConversation(), 300);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('[Minimap] MutationObserver started');
  }

  /**
   * Check if a DOM node is likely a message node
   */
  private isMessageNode(node: HTMLElement): boolean {
    if (!node.querySelector) return false;
    const text = node.textContent || '';
    return text.length > 20;
  }

  /**
   * Scan the conversation and identify all sections
   * This is the core logic that finds user prompts and Claude responses
   */
  private scanConversation(): void {
    console.log('[Minimap] Scanning conversation...');

    // // Find all message elements
    // const allMessages = Array.from(document.querySelectorAll('div'))
    //   .filter(div => {
    //     const text = div.textContent;
    //     if (!text || text.length < 20) return false;

    //     // Look for indicators that this is a message
    //     const hasUserIndicator = div.querySelector('[data-testid*="user"]') ||
    //       div.classList.toString().includes('user');
    //     const hasAssistantIndicator = div.querySelector('[data-testid*="assistant"]') ||
    //       div.classList.toString().includes('claude') ||
    //       div.classList.toString().includes('assistant');

    //     return hasUserIndicator || hasAssistantIndicator;
    //   }) as HTMLElement[];

    // Find all message elements
    // let allMessages = Array.from(document.querySelectorAll('div'))
    //   .filter(div => {
    //     const text = div.textContent;
    //     if (!text || text.length < 20) return false;

    //     // Look for indicators that this is a message
    //     const hasUserIndicator = div.querySelector('[data-testid*="user"]') ||
    //       div.classList.toString().includes('user');
    //     const hasAssistantIndicator = div.querySelector('[data-testid*="assistant"]') ||
    //       div.classList.toString().includes('claude') ||
    //       div.classList.toString().includes('assistant');

    //     return hasUserIndicator || hasAssistantIndicator;
    //   }) as HTMLElement[];
    let allMessages = Array.from(document.querySelectorAll('[data-testid="user-message"]')) as HTMLElement[];

    console.log(`[Minimap] Found ${allMessages.length} potential messages`);

    // Group into sections (user prompt + responses)
    const newSections: Section[] = [];
    let currentSection: Section | null = null;

    allMessages.forEach(msg => {
      const text = this.extractText(msg);
      if (text.length < 10) return;

      const isUser = this.isUserMessage(msg);

      if (isUser) {
        // Start new section with user prompt
        currentSection = {
          id: newSections.length,
          prompt: { text, element: msg },
          responses: []
        };
        newSections.push(currentSection);
      } else if (currentSection) {
        // Add to current section's responses
        currentSection.responses.push({ text, element: msg });
      }
    });

    console.log(`[Minimap] Grouped into ${newSections.length} sections`);

    // Update if changed
    if (this.sectionsChanged(newSections)) {
      this.sections = newSections;
      this.renderMarkers();
      console.log('[Minimap] Sections updated and markers rendered');
    }
  }

  /**
   * Extract clean text from an element
   */
  private extractText(element: HTMLElement): string {
    let text = element.textContent || '';
    text = text.trim().replace(/\s+/g, ' ');
    return text.substring(0, 100);
  }

  /**
   * Determine if a message is from the user
   */
  private isUserMessage(element: HTMLElement): boolean {
    const html = element.innerHTML.toLowerCase();
    const className = element.className.toLowerCase();

    return html.includes('user') ||
      className.includes('user') ||
      element.querySelector('[data-testid*="user"]') !== null;
  }

  /**
   * Check if sections array has changed
   */
  private sectionsChanged(newSections: Section[]): boolean {
    if (newSections.length !== this.sections.length) return true;

    if (newSections.length > 0 && this.sections.length > 0) {
      const lastNew = newSections[newSections.length - 1];
      const lastOld = this.sections[this.sections.length - 1];

      // TypeScript null safety: both should exist due to length checks above
      if (!lastNew || !lastOld) return false;

      return lastNew.prompt.text !== lastOld.prompt.text ||
        lastNew.responses.length !== lastOld.responses.length;
    }

    return false;
  }

  /**
 * Apply collision detection to prevent overlapping markers
 */
  // private applyCollisionDetection(
  //   markers: Array<{ section: Section; idx: number; positionPercent: number }>
  // ): Array<{ section: Section; idx: number; positionPercent: number }> {
  //   if (markers.length === 0) return markers;

  //   const markerHeightPercent = 3.5; // Approximate marker height as % of track (adjust as needed)
  //   const adjusted: Array<{ section: Section; idx: number; positionPercent: number }> = [];

  //   // Sort by position
  //   const sorted = [...markers].sort((a, b) => a.positionPercent - b.positionPercent);

  //   sorted.forEach((marker) => {
  //     let newPosition = marker.positionPercent;

  //     // Check against all previously placed markers
  //     for (const prev of adjusted) {
  //       const distance = newPosition - prev.positionPercent;

  //       // If overlapping or too close, push down
  //       if (distance < markerHeightPercent) {
  //         newPosition = prev.positionPercent + markerHeightPercent;
  //       }
  //     }

  //     // Don't go past 95%
  //     if (newPosition > 95) {
  //       newPosition = 95;
  //     }

  //     adjusted.push({
  //       ...marker,
  //       positionPercent: newPosition
  //     });
  //   });

  //   return adjusted;
  // }

  /**
   * Render markers on the minimap for each section
   */
  /**
  * Render markers on the minimap for each section
  */
  private renderMarkers(): void {
    const markersContainer = document.getElementById('minimap-markers');
    if (!markersContainer) return;

    console.log(`[Minimap] Rendering ${this.sections.length} markers...`);

    markersContainer.innerHTML = '';
    this.markers = [];

    const container = this.scrollContainer as HTMLElement;
    const scrollHeight = container.scrollHeight || 1;

    // Calculate positions for all sections
    const markerPositions = this.sections.map((section, idx) => {
      const elementTop = this.getElementScrollTop(section.prompt.element);
      const positionPercent = (elementTop / scrollHeight) * 100;
      return { section, idx, positionPercent };
    });

    // Cluster every 10 markers
    const clusters = this.clusterMarkers(markerPositions);

    // CHANGED: Check if individual markers will fit, otherwise force clustering
    const markerHeightPercent = 3.5;
    const individualMarkers: Array<{ section: Section; idx: number; positionPercent: number }> = [];
    const forcedClusters: typeof clusters = [];

    clusters.forEach(cluster => {
      if (cluster.markers.length < 10) {
        // Check if these individual markers will fit
        individualMarkers.push(...cluster.markers);
      } else {
        // Already a cluster of 10
        forcedClusters.push(cluster);
      }
    });

    // Check if individual markers can fit without overlapping
    const canFit = this.checkIfMarkersFit(individualMarkers, markerHeightPercent);

    if (!canFit) {
      // Can't fit - force all remaining individual markers into clusters
      console.log('[Minimap] Not enough space - forcing clustering');

      // Re-cluster everything more aggressively (every 5 markers instead of 10)
      const aggressiveClusters = this.clusterMarkersAggressive(markerPositions, 5);

      aggressiveClusters.forEach(cluster => {
        if (cluster.markers.length === 1) {
          this.renderSingleMarker(cluster.markers[0], markersContainer);
        } else {
          this.renderCluster(cluster, markersContainer);
        }
      });
    } else {
      // Can fit - render normally
      individualMarkers.forEach(markerData => {
        this.renderSingleMarker(markerData, markersContainer);
      });

      forcedClusters.forEach(cluster => {
        this.renderCluster(cluster, markersContainer);
      });
    }

    console.log(`[Minimap] Rendered ${this.markers.length} markers/clusters`);
  }

  /**
   * Check if markers can fit without overlapping
   */
  private checkIfMarkersFit(
    markers: Array<{ section: Section; idx: number; positionPercent: number }>,
    markerHeightPercent: number
  ): boolean {
    if (markers.length === 0) return true;

    const sorted = [...markers].sort((a, b) => a.positionPercent - b.positionPercent);
    let currentPosition = sorted[0].positionPercent;

    for (let i = 1; i < sorted.length; i++) {
      currentPosition += markerHeightPercent;

      // If we need to place marker beyond where it naturally belongs
      if (currentPosition > sorted[i].positionPercent) {
        // And we're approaching the limit
        if (currentPosition > 95) {
          return false; // Won't fit
        }
      } else {
        currentPosition = sorted[i].positionPercent;
      }
    }

    return currentPosition <= 95; // Fits if we didn't exceed limit
  }

  /**
   * Cluster markers more aggressively when space is limited
   */
  private clusterMarkersAggressive(
    positions: Array<{ section: Section; idx: number; positionPercent: number }>,
    clusterSize: number
  ): Array<{ markers: Array<{ section: Section; idx: number; positionPercent: number }>; avgPosition: number }> {
    const clusters: Array<{
      markers: Array<{ section: Section; idx: number; positionPercent: number }>;
      avgPosition: number
    }> = [];

    const sorted = [...positions].sort((a, b) => a.positionPercent - b.positionPercent);

    for (let i = 0; i < sorted.length; i += clusterSize) {
      const clusterMarkers = sorted.slice(i, i + clusterSize);
      const firstMarkerPos = clusterMarkers[0].positionPercent;

      clusters.push({
        markers: clusterMarkers,
        avgPosition: firstMarkerPos
      });
    }

    return clusters;
  }
  /**
   * Cluster markers that are close together
   */
  private clusterMarkers(
    positions: Array<{ section: Section; idx: number; positionPercent: number }>,
  ): Array<{ markers: Array<{ section: Section; idx: number; positionPercent: number }>; avgPosition: number }> {
    const clusters: Array<{
      markers: Array<{ section: Section; idx: number; positionPercent: number }>;
      avgPosition: number
    }> = [];

    // Sort by position
    const sorted = [...positions].sort((a, b) => a.positionPercent - b.positionPercent);

    // Group every 10 markers into a cluster
    for (let i = 0; i < sorted.length; i += 10) {
      const clusterMarkers = sorted.slice(i, i + 10);
      // CHANGED: Use the position of the first marker instead of average
      const firstMarkerPos = clusterMarkers[0].positionPercent;

      clusters.push({
        markers: clusterMarkers,
        avgPosition: firstMarkerPos
      });
    }

    return clusters;
  }

  /**
   * Render a single marker
   */
  private renderSingleMarker(
    markerData: { section: Section; idx: number; positionPercent: number },
    container: HTMLElement
  ): void {
    const { section, idx, positionPercent } = markerData;

    const marker = document.createElement('div');
    marker.className = 'minimap-marker';
    marker.style.top = `${positionPercent}%`;
    marker.setAttribute('data-section-id', idx.toString());
    marker.setAttribute('data-text', section.prompt.text);

    const label = document.createElement('div');
    label.className = 'minimap-marker-label';
    const preview = section.prompt.text.length > 25
      ? section.prompt.text.substring(0, 25) + '...'
      : section.prompt.text;
    label.textContent = preview;
    marker.appendChild(label);

    // Click handler
    marker.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      this.jumpToSection(idx);
    });

    // Hover handlers for tooltip
    marker.addEventListener('mouseenter', (e: MouseEvent) => {
      this.showTooltip(e.clientX, e.clientY, section.prompt.text);
    });

    marker.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });

    marker.addEventListener('mousemove', (e: MouseEvent) => {
      this.showTooltip(e.clientX, e.clientY, section.prompt.text);
    });

    container.appendChild(marker);
    this.markers.push({ element: marker, section, positionPercent });
  }

  /**
   * Render a cluster of markers
   */
  private renderCluster(
    cluster: { markers: Array<{ section: Section; idx: number; positionPercent: number }>; avgPosition: number },
    container: HTMLElement
  ): void {
    const clusterDiv = document.createElement('div');
    clusterDiv.className = 'minimap-cluster';
    // Calculate safe position to keep cluster in view
    let safePosition = cluster.avgPosition;
    // If cluster is in top 20%, push it down to ensure X is visible
    if (safePosition < 20) {
      safePosition = 10;
    }
    // If cluster is in bottom 10%, push it up
    if (safePosition > 90) {
      safePosition = 90;
    }
    clusterDiv.style.top = `${safePosition}%`;

    const count = cluster.markers.length;
    const label = document.createElement('div');
    label.className = 'minimap-cluster-label';
    label.textContent = `${count}`;
    clusterDiv.appendChild(label);

    (clusterDiv as any).isExpanded = false;

    // Click to expand/collapse
    clusterDiv.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();

      if (!(clusterDiv as any).isExpanded) {
        // ADDED: Close any other expanded clusters first
        this.closeAllClusters();

        // Expand this cluster
        this.expandCluster(clusterDiv, cluster);
        (clusterDiv as any).isExpanded = true;

        // CHANGED: Remove background, show X
        clusterDiv.style.background = 'transparent';
        clusterDiv.style.border = 'none';
        label.style.display = '';
        label.textContent = '×';
        label.style.fontSize = '24px';
        label.style.color = 'rgba(204, 93, 44, 0.9)';
        label.style.position = 'absolute';
        label.style.top = '4px';
        label.style.right = '4px';
        label.style.zIndex = '1000';

      } else {
        this.collapseCluster(clusterDiv);
        (clusterDiv as any).isExpanded = false;

        // Restore original style
        clusterDiv.style.background = '';
        clusterDiv.style.border = '';
        label.style.fontSize = '14px';
        label.style.color = 'white';
        label.style.position = '';
        label.style.top = '';
        label.style.right = '';
        label.style.zIndex = '';
        label.textContent = `${count}`;
      }
    });

    // Hover to show summary (only when collapsed)
    clusterDiv.addEventListener('mouseenter', (e: MouseEvent) => {
      if (!(clusterDiv as any).isExpanded) {
        const summaryText = cluster.markers
          .map((m, i) => `${i + 1}. ${m.section.prompt.text}`)
          .join('\n\n');
        this.showTooltip(e.clientX, e.clientY, summaryText);
      }
    });

    clusterDiv.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });

    container.appendChild(clusterDiv);

    this.markers.push({
      element: clusterDiv,
      section: cluster.markers[0].section,
      positionPercent: cluster.avgPosition
    });
  }

  /**
   * Close all expanded clusters
   */
  private closeAllClusters(): void {
    const clusters = document.querySelectorAll('.minimap-cluster.expanded');
    clusters.forEach(cluster => {
      const clusterDiv = cluster as HTMLElement;
      this.collapseCluster(clusterDiv);
      (clusterDiv as any).isExpanded = false;

      // Restore style
      const label = clusterDiv.querySelector('.minimap-cluster-label') as HTMLElement;
      if (label) {
        const expandedMarkers = clusterDiv.querySelectorAll('.expanded-marker');
        const count = expandedMarkers.length || label.textContent;
        clusterDiv.style.background = '';
        clusterDiv.style.border = '';
        label.style.fontSize = '14px';
        label.style.color = 'white';
        label.style.position = '';
        label.style.top = '';
        label.style.right = '';
        label.style.zIndex = '';
        // Get the original count from the cluster
        const originalCount = cluster.querySelectorAll('.expanded-marker').length;
        label.textContent = originalCount > 0 ? originalCount.toString() : count.toString();
        label.style.display = 'flex'; // Make sure it's visible again
      }
    });
  }

  /**
   * Expand a cluster to show individual markers
   */
  private expandCluster(
    clusterDiv: HTMLElement,
    cluster: { markers: Array<{ section: Section; idx: number; positionPercent: number }>; avgPosition: number }
  ): void {
    clusterDiv.classList.add('expanded');

    // CHANGED: Stack from top (no spacing offset)
    cluster.markers.forEach((markerData) => {
      const { section, idx } = markerData;

      const expandedMarker = document.createElement('div');
      expandedMarker.className = 'minimap-marker expanded-marker';
      expandedMarker.style.position = 'relative';
      expandedMarker.style.top = '0';
      expandedMarker.style.marginBottom = '4px';

      const label = document.createElement('div');
      label.className = 'minimap-marker-label';
      const preview = section.prompt.text.length > 25
        ? section.prompt.text.substring(0, 25) + '...'
        : section.prompt.text;
      label.textContent = preview;
      expandedMarker.appendChild(label);

      // Click to jump
      expandedMarker.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        this.jumpToSection(idx);
        // CHANGED: Close all clusters instead of just this one
        this.closeAllClusters();
      });

      clusterDiv.appendChild(expandedMarker);
    });
  }

  /**
   * Collapse an expanded cluster
   */
  private collapseCluster(clusterDiv: HTMLElement): void {
    clusterDiv.classList.remove('expanded');

    // Remove expanded markers
    const expandedMarkers = clusterDiv.querySelectorAll('.expanded-marker');
    expandedMarkers.forEach(marker => marker.remove());
  }

  /**
   * Get element's position relative to scroll container
   */
  private getElementScrollTop(element: HTMLElement): number {
    const elementRect = element.getBoundingClientRect();
    const container = this.scrollContainer as HTMLElement;
    const containerRect = container.getBoundingClientRect();

    return elementRect.top - containerRect.top + (container.scrollTop || 0);
  }


  /**
   * Handle click on the minimap track
   */
  private handleTrackClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    // Don't handle if clicking on marker
    if (target.classList.contains('minimap-marker') ||
      target.classList.contains('minimap-marker-label')) {
      return;
    }

    const track = document.getElementById('minimap-track');
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const clickPercent = clickY / rect.height;

    const container = this.scrollContainer as HTMLElement;
    const scrollHeight = container.scrollHeight || 1;
    const targetScroll = scrollHeight * clickPercent;

    container.scrollTo({
      top: targetScroll,
      behavior: 'smooth'
    });

    console.log(`[Minimap] Track clicked at ${(clickPercent * 100).toFixed(1)}%`);
  }

  /**
   * Start dragging the viewport
   */
  // private startDrag(e: MouseEvent): void {
  //   e.preventDefault();
  //   this.isDragging = true;
  //   document.body.style.userSelect = 'none';
  //   console.log('[Minimap] Drag started');
  // }

  /**
   * Handle dragging the viewport
   */
  // private handleDrag(e: MouseEvent): void {
  //   if (!this.isDragging) return;

  //   const track = document.getElementById('minimap-track');
  //   if (!track) return;

  //   const rect = track.getBoundingClientRect();
  //   const mouseY = e.clientY - rect.top;
  //   const percent = Math.max(0, Math.min(1, mouseY / rect.height));

  //   const container = this.scrollContainer as HTMLElement;
  //   const scrollHeight = container.scrollHeight || 1;
  //   const targetScroll = scrollHeight * percent;

  //   container.scrollTop = targetScroll;
  // }

  /**
   * Stop dragging the viewport
   */
  // private stopDrag(): void {
  //   if (this.isDragging) {
  //     this.isDragging = false;
  //     document.body.style.userSelect = '';
  //     console.log('[Minimap] Drag stopped');
  //   }
  // }

  /**
   * Handle hover over the minimap to show tooltips
   */
  private handleHover(e: MouseEvent): void {
    const track = document.getElementById('minimap-track');
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const hoverPercent = (mouseY / rect.height) * 100;

    // Find nearest marker within 5% range
    let nearestMarker: MarkerData | undefined;
    let nearestDistance = Infinity;

    this.markers.forEach(marker => {
      const distance = Math.abs(marker.positionPercent - hoverPercent);
      if (distance < 5 && distance < nearestDistance) {
        nearestDistance = distance;
        nearestMarker = marker;
      }
    });

    if (nearestMarker) {
      // Show the message preview text
      const text = nearestMarker.section.prompt.text;
      this.showTooltip(e.clientX, e.clientY, text);
    } else {
      this.hideTooltip();
    }
  }

  /**
   * Show tooltip with prompt text
   */
  private showTooltip(x: number, y: number, text: string): void {
    const tooltip = document.getElementById('minimap-tooltip');
    if (!tooltip) return;

    tooltip.textContent = text;
    tooltip.style.display = 'block';
    tooltip.style.left = `${x - tooltip.offsetWidth - 20}px`;
    tooltip.style.top = `${y - tooltip.offsetHeight / 2}px`;
  }

  /**
   * Hide tooltip
   */
  private hideTooltip(): void {
    const tooltip = document.getElementById('minimap-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }

  /**
   * Jump to a specific section
   */
  private jumpToSection(sectionId: number): void {
    if (sectionId < 0 || sectionId >= this.sections.length) return;

    const section = this.sections[sectionId];
    if (!section) return; // Additional safety check
    console.log('[Minimap] Jumping to section, element:', section.prompt.element);
    console.log('[Minimap] Element classes:', section.prompt.element.className);
    console.log('[Minimap] Element inline styles:', section.prompt.element.style.cssText);

    section.prompt.element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    // Remove focus and any background that appears
    section.prompt.element.blur();

    // Force remove backgrounds on the element and its children
    const removeBackgrounds = () => {
      section.prompt.element.style.backgroundColor = 'transparent';
      section.prompt.element.style.background = 'transparent';

      // Also check parent elements
      let parent = section.prompt.element.parentElement;
      while (parent && parent !== document.body) {
        parent.style.backgroundColor = 'transparent';
        parent.style.background = 'transparent';
        parent = parent.parentElement;
      }
    };

    // Run immediately and after a delay (in case Claude's JS adds it later)
    removeBackgrounds();
    setTimeout(removeBackgrounds, 100);
    setTimeout(removeBackgrounds, 500);

    // Flash highlight
    // this.highlightElement(section.prompt.element);

    console.log(`[Minimap] Jumped to section ${sectionId + 1}`);
  }

  /**
   * Jump to next section
   */
  private jumpToNextSection(): void {
    const container = this.scrollContainer as HTMLElement;
    const currentScroll = container.scrollTop || 0;

    // Find first section below current scroll position
    for (let i = 0; i < this.sections.length; i++) {
      const section = this.sections[i];
      if (!section) continue; // Skip if undefined

      const elementTop = this.getElementScrollTop(section.prompt.element);
      if (elementTop > currentScroll + 50) {
        this.jumpToSection(i);
        return;
      }
    }

    console.log('[Minimap] No next section found');
  }

  /**
   * Jump to previous section
   */
  private jumpToPreviousSection(): void {
    const container = this.scrollContainer as HTMLElement;
    const currentScroll = container.scrollTop || 0;

    // Find last section above current scroll position
    for (let i = this.sections.length - 1; i >= 0; i--) {
      const section = this.sections[i];
      if (!section) continue; // Skip if undefined

      const elementTop = this.getElementScrollTop(section.prompt.element);
      if (elementTop < currentScroll - 50) {
        this.jumpToSection(i);
        return;
      }
    }

    console.log('[Minimap] No previous section found');
  }

  /**
   * Highlight an element with a flash effect
   */
  // private highlightElement(element: HTMLElement): void {
  //   element.style.transition = 'background-color 0.3s';
  //   // element.style.backgroundColor = 'rgba(139, 92, 246, 0.15)';
  //   setTimeout(() => {
  //     element.style.backgroundColor = '';
  //   }, 800);
  // }

  // ============================================================================
  // PUBLIC API FOR TESTING
  // ============================================================================

  /**
   * Get current state for debugging
   */
  public getState(): object {
    return {
      isVisible: this.isVisible,
      isDragging: this.isDragging,
      sectionsCount: this.sections.length,
      markersCount: this.markers.length,
      sections: this.sections.map(s => ({
        id: s.id,
        promptText: s.prompt.text,
        responsesCount: s.responses.length
      }))
    };
  }

  /**
   * Force re-scan (for testing)
   */
  public forceScan(): void {
    console.log('[Minimap] Force scan triggered');
    this.scanConversation();
  }

  /**
   * Force re-render (for testing)
   */
  public forceRender(): void {
    console.log('[Minimap] Force render triggered');
    this.renderMarkers();
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Make globally accessible for testing
let minimapInstance: ClaudeMinimap | null = null;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    minimapInstance = new ClaudeMinimap();
    // Expose to window for testing
    (window as any).claudeMinimap = minimapInstance;
  });
} else {
  minimapInstance = new ClaudeMinimap();
  (window as any).claudeMinimap = minimapInstance;
}