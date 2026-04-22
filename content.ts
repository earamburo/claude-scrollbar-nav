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
}

interface StorageData {
  minimapVisible?: boolean;
}

class ClaudeMinimap {
  private minimap: HTMLDivElement | null = null;
  private scrollContainer: HTMLElement | Document = document.documentElement;
  private markers: MarkerData[] = [];
  private sections: Section[] = [];
  private isVisible: boolean = true;
  private observer: MutationObserver | null = null;
  private scanTimeout: number | null = null;

  constructor() {
    this.init();
  }

  // ==========================================================================
  // V1: CORE — show minimap with markers, auto-update as messages arrive
  // ==========================================================================

  private async init(): Promise<void> {
    await this.loadSavedState();

    setTimeout(() => {
      this.findScrollContainer();
      this.createMinimap();
      this.startObserving();
      this.scanConversation();
    }, 1000);
  }

  private async loadSavedState(): Promise<void> {
    try {
      const saved = await chrome.storage.local.get(['minimapVisible']) as StorageData;
      if (saved.minimapVisible !== undefined) {
        this.isVisible = saved.minimapVisible;
      }
    } catch (error) {
      console.error('[Minimap] Error loading state:', error);
    }
  }

  private findScrollContainer(): void {
    this.scrollContainer = document.documentElement;
    const containers = document.querySelectorAll('[class*="scroll"], [style*="overflow"]');

    for (const container of Array.from(containers)) {
      const el = container as HTMLElement;
      const style = window.getComputedStyle(el);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          el.scrollHeight > el.clientHeight) {
        this.scrollContainer = el;
        break;
      }
    }
  }

  private createMinimap(): void {
    document.getElementById('claude-minimap')?.remove();

    const container = this.scrollContainer as HTMLElement;
    const containerStyle = window.getComputedStyle(container);
    const containerHeight = containerStyle.height; // already includes "px"
    const paddingTop = containerStyle.paddingTop;
    const paddingBottom = containerStyle.paddingBottom;

    this.minimap = document.createElement('div');
    this.minimap.id = 'claude-minimap';
    this.minimap.className = this.isVisible ? '' : 'hidden';
    this.minimap.style.height = containerHeight;
    this.minimap.style.overflow = 'visible';
    this.minimap.style.overflowX = 'hidden';

    this.minimap.innerHTML = `
      <div class="minimap-track" id="minimap-track" style="height: 100%; padding: ${paddingTop} 0 ${paddingBottom} 0; overflow: visible; overflow-x: hidden;">
        <div class="minimap-markers" id="minimap-markers"></div>
      </div>
    `;

    document.body.appendChild(this.minimap);
    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const track = document.getElementById('minimap-track');
    if (!track) return;

    track.addEventListener('click', (e) => this.handleTrackClick(e));
  }

  // Watches for new messages and re-scans with 300ms debounce
  private startObserving(): void {
    this.observer = new MutationObserver((mutations: MutationRecord[]) => {
      let shouldScan = false;

      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeType === 1 && this.isMessageNode(node as HTMLElement)) {
            shouldScan = true;
            break;
          }
        }
        if (shouldScan) break;
      }

      if (shouldScan) {
        if (this.scanTimeout) clearTimeout(this.scanTimeout);
        this.scanTimeout = window.setTimeout(() => this.scanConversation(), 300);
      }
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  private isMessageNode(node: HTMLElement): boolean {
    if (!node.querySelector) return false;
    return (node.textContent || '').length > 20;
  }

  private scanConversation(): void {
    const allMessages = Array.from(
      document.querySelectorAll('[data-testid="user-message"]')
    ) as HTMLElement[];

    const newSections: Section[] = [];
    let currentSection: Section | null = null;

    allMessages.forEach(msg => {
      const text = this.extractText(msg);
      if (text.length < 10) return;

      if (this.isUserMessage(msg)) {
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

    if (this.sectionsChanged(newSections)) {
      this.sections = newSections;
      this.renderMarkers();
    }
  }

  private extractText(element: HTMLElement): string {
    return (element.textContent || '').trim().replace(/\s+/g, ' ').substring(0, 100);
  }

  private isUserMessage(element: HTMLElement): boolean {
    return element.querySelector('[data-testid*="user"]') !== null ||
      element.className.toLowerCase().includes('user');
  }

  private sectionsChanged(newSections: Section[]): boolean {
    if (newSections.length !== this.sections.length) return true;
    if (newSections.length === 0) return false;

    const lastNew = newSections[newSections.length - 1]!;
    const lastOld = this.sections[this.sections.length - 1]!;
    return lastNew.prompt.text !== lastOld.prompt.text ||
      lastNew.responses.length !== lastOld.responses.length;
  }

  private renderMarkers(): void {
    const markersContainer = document.getElementById('minimap-markers');
    if (!markersContainer) return;

    markersContainer.innerHTML = '';
    this.markers = [];

    markersContainer.style.display = 'flex';
    markersContainer.style.flexDirection = 'column';
    markersContainer.style.gap = '8px';
    markersContainer.style.padding = '8px 0';

    this.sections.forEach((section, idx) => {
      this.renderSingleMarker({ section, idx }, markersContainer);
    });
  }

  private renderSingleMarker(
    markerData: { section: Section; idx: number },
    container: HTMLElement
  ): void {
    const { section } = markerData;

    const marker = document.createElement('div');
    marker.className = 'minimap-marker';
    marker.style.position = 'relative';
    marker.style.top = '0';
    marker.style.transform = 'none';

    const label = document.createElement('div');
    label.className = 'minimap-marker-label';
    label.textContent = section.prompt.text.length > 20
      ? section.prompt.text.substring(0, 20) + '...'
      : section.prompt.text;
    marker.appendChild(label);

    container.appendChild(marker);
    this.markers.push({ element: marker, section });
  }

  // Clicking the track background scrolls proportionally to that position
  private handleTrackClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target.classList.contains('minimap-marker') ||
        target.classList.contains('minimap-marker-label')) return;

    const track = document.getElementById('minimap-track');
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const clickPercent = (e.clientY - rect.top) / rect.height;
    const container = this.scrollContainer as HTMLElement;

    container.scrollTo({ top: container.scrollHeight * clickPercent, behavior: 'smooth' });
  }


  // ==========================================================================
  // DEBUG HELPERS
  // ==========================================================================

  public getState(): object {
    return {
      isVisible: this.isVisible,
      sectionsCount: this.sections.length,
      markersCount: this.markers.length,
      sections: this.sections.map(s => ({ id: s.id, promptText: s.prompt.text }))
    };
  }

  public forceScan(): void { this.scanConversation(); }
  public forceRender(): void { this.renderMarkers(); }
}

// ============================================================================
// V2 — to implement next:
//   - jumpToSection()         click marker → smooth scroll to message
//   - toggleMinimap()         show/hide with keyboard shortcut or button
//   - setupKeyboardShortcuts() Ctrl+Shift+P/N to jump prev/next
//   - setupChatChangeListener() re-scan when URL changes (new chat)
//   - setupScrollSync()        viewport indicator that tracks scroll position
//
// V3 — clustering (for very long conversations):
//   - clusterMarkers()         group every N markers when space runs out
//   - renderCluster()          expandable cluster pill
//   - expandCluster() / collapseCluster() / closeAllClusters()
//   - checkIfMarkersFit()      decide whether to cluster
//
// V4 — tooltips:
//   - showTooltip() / hideTooltip() / handleHover()
// ============================================================================

// ============================================================================
// INITIALIZATION
// ============================================================================

let minimapInstance: ClaudeMinimap | null = null;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    minimapInstance = new ClaudeMinimap();
    (window as any).claudeMinimap = minimapInstance;
  });
} else {
  minimapInstance = new ClaudeMinimap();
  (window as any).claudeMinimap = minimapInstance;
}
