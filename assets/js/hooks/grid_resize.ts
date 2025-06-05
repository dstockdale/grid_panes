// Types and Interfaces
interface PaneData {
  id: string;
  size: number;
  sizeMin?: number;
  sizeMax?: number;
}

interface PaneOptions {
  paneId: string;
  paneType: string;
  paneTarget?: string;
  paneSizeDefault: string;
  paneSizeMin?: string;
  paneSizeMax?: string;
  paneSizeUnit: string;
  paneDirection?: string;
  paneDividerPosition?: string;
  direction: string;
}

interface InitialState {
  target: {
    size: number;
    position: number;
  };
  siblings: Array<{
    id: string;
    size: number;
    position: number;
  }>;
  container: {
    size: number;
  };
}

type SizeUnit = "px" | "fr";
type Direction = "row" | "column";
type PaneType = "divider" | "group" | "pane";
type DividerPosition = "start" | "end";

// Utility Functions
class GridResizeUtils {
  static getFlexSpacePx(
    containerPx: number,
    fixedTrackPx: number,
    gapsPx: number
  ): number {
    return containerPx - fixedTrackPx - gapsPx;
  }

  static pxPerFr(flexSpacePx: number, totalFr: number): number {
    return flexSpacePx / totalFr;
  }

  static getAttribute<T>(
    object: Record<string, any>,
    attribute: string,
    defaultValue: T = null as T
  ): T {
    return object[attribute] || defaultValue;
  }

  static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Distributes fr delta among panes proportionally
   */
  static distributeFrDelta(
    target: PaneData,
    allFrPanes: PaneData[],
    deltaPx: number,
    flexPx: number
  ): PaneData[] {
    const totalFr = allFrPanes.reduce((acc, pane) => acc + pane.size, 0);
    const ppf = flexPx / totalFr; // pixels per fr unit

    // Convert pixel delta to fr delta
    const deltaFr = deltaPx / ppf;

    // Find target index
    const targetIdx = allFrPanes.findIndex((pane) => pane.id === target.id);

    // Calculate new target size (with basic constraints)
    const minFr = (target.sizeMin || 0) / ppf;
    const maxFr =
      target.sizeMax === Infinity
        ? Infinity
        : (target.sizeMax || Infinity) / ppf;
    const newTargetSize = Math.max(
      minFr,
      Math.min(maxFr, target.size + deltaFr)
    );
    const actualDeltaFr = newTargetSize - target.size;

    // Distribute the opposite delta among other fr panes proportionally
    const otherPanes = allFrPanes.filter((_, idx) => idx !== targetIdx);
    const otherTotalFr = otherPanes.reduce((acc, pane) => acc + pane.size, 0);

    if (otherTotalFr === 0) {
      // Edge case: only one fr pane
      return [
        {
          id: target.id,
          size: newTargetSize,
        },
      ];
    }

    // Create result array
    return allFrPanes.map((pane, idx) => {
      if (idx === targetIdx) {
        return {
          id: pane.id,
          size: newTargetSize,
        };
      } else {
        // Distribute the negative delta proportionally
        const proportion = pane.size / otherTotalFr;
        const adjustment = -actualDeltaFr * proportion;
        const newSize = Math.max(0.001, pane.size + adjustment); // Minimum 0.1fr

        return {
          id: pane.id,
          size: newSize,
        };
      }
    });
  }
}

// Pane Class
class Pane {
  public readonly el: HTMLElement;
  public readonly id: string;
  public readonly type: PaneType;
  public readonly target: string;
  public readonly sizeDefault: number;
  public readonly sizeMin: number;
  public readonly sizeMax: number;
  public readonly sizeUnit: SizeUnit;
  public readonly direction: Direction;
  public readonly collapseAt: number;
  public readonly collapseTo: number;

  public start: number = 0;
  public end: number = 0;
  public size: number = 0;
  public sizePx: number = 0;
  public clientAxis: "clientX" | "clientY" = "clientX";

  constructor(el: HTMLElement, options: PaneOptions) {
    this.el = el;
    this.id = GridResizeUtils.getAttribute(options, "paneId", "");
    this.type = GridResizeUtils.getAttribute(
      options,
      "paneType",
      "pane"
    ) as PaneType;
    this.target = GridResizeUtils.getAttribute(options, "paneTarget", "");
    this.sizeDefault = Number(
      GridResizeUtils.getAttribute(options, "paneSizeDefault", "0")
    );
    this.sizeMin = Number(
      GridResizeUtils.getAttribute(options, "paneSizeMin", "0")
    );
    this.sizeMax = Number(
      GridResizeUtils.getAttribute(options, "paneSizeMax", "Infinity")
    );
    this.sizeUnit = GridResizeUtils.getAttribute(
      options,
      "paneSizeUnit",
      "px"
    ) as SizeUnit;
    this.direction = GridResizeUtils.getAttribute(
      options,
      "paneDirection",
      options.direction
    ) as Direction;
    this.collapseAt = Number(
      GridResizeUtils.getAttribute(options, "paneCollapseAt", "0")
    );
    this.collapseTo = Number(
      GridResizeUtils.getAttribute(options, "paneCollapseTo", "0")
    );
    this.updateDimensions();
  }

  public updateDimensions(): void {
    const rect = this.el.getBoundingClientRect();
    const { width, height, top, bottom, left, right } = rect;

    if (this.direction === "row") {
      this.start = top;
      this.end = bottom;
      this.size = this.calculateSize(height, this.sizeUnit);
      this.sizePx = height;
      this.clientAxis = "clientY";
    } else {
      this.start = left;
      this.end = right;
      this.size = this.calculateSize(width, this.sizeUnit);
      this.sizePx = width;
      this.clientAxis = "clientX";
    }
  }

  private calculateSize(size: number, unit: SizeUnit): number {
    if (unit === "px") {
      return size;
    } else {
      return this.getCurrentFrValue();
    }
  }

  private getCurrentFrValue(): number {
    const root = document.documentElement;
    const value = getComputedStyle(root).getPropertyValue(`--${this.id}-size`);

    const frValue = parseFloat(value.replace("fr", ""));
    return isNaN(frValue) ? this.sizeDefault : frValue;
  }

  public isCollapsed(): boolean {
    return this.size <= this.collapseAt;
  }
}

// Helper function to find parent group
function findParentGroup(element: HTMLElement): Pane {
  let parent = element.parentElement;

  while (parent) {
    if (parent.dataset.paneType === "group") {
      return new Pane(parent, parent.dataset as unknown as PaneOptions);
    }
    parent = parent.parentElement;
  }

  throw new Error("No parent group found");
}

// Divider Class
class Divider {
  private readonly element: HTMLElement;
  private readonly target: Pane;
  private readonly siblings: Pane[];
  private readonly container: Pane;
  private readonly dividerPosition: DividerPosition;

  private isDragging: boolean = false;
  private initialState: InitialState | null = null;
  private startPosition: number = 0;

  constructor(
    element: HTMLElement,
    target: Pane,
    siblings: Pane[],
    container: Pane
  ) {
    this.element = element;
    this.target = target;
    this.siblings = siblings;
    this.container = container;
    this.dividerPosition = (element.dataset.paneDividerPosition ||
      "start") as DividerPosition;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.element.addEventListener("mousedown", this.handleMouseDown);
    this.element.addEventListener("touchstart", this.handleTouchStart);
    this.element.addEventListener("dblclick", this.handleDoubleClick);
  }

  private handleMouseDown = (event: MouseEvent): void => {
    this.startDragging(event);
  };

  private handleTouchStart = (event: TouchEvent): void => {
    this.startDragging(event);
  };

  private handleDoubleClick = (): void => {
    this.reset();
  };

  private handleMouseMove = (event: MouseEvent): void => {
    this.onDrag(event);
  };

  private handleMouseUp = (): void => {
    this.onDragEnd();
  };

  private handleTouchMove = (event: TouchEvent): void => {
    this.onDrag(event);
  };

  private handleTouchEnd = (): void => {
    this.onDragEnd();
  };

  private captureInitialState(): InitialState {
    // Refresh dimensions for all panes
    this.target.updateDimensions();
    this.siblings.forEach((sibling) => sibling.updateDimensions());
    this.container.updateDimensions();

    return {
      target: {
        size: this.target.size,
        position: this.target.start,
      },
      siblings: this.siblings.map((sibling) => ({
        id: sibling.id,
        size: sibling.size,
        position: sibling.start,
      })),
      container: {
        size: this.container.size,
      },
    };
  }

  private checkCollapseCondition(newSize: number, currentSize: number): number {
    // Skip if collapsing is disabled
    if (this.target.collapseAt === 0) {
      return newSize;
    }

    const isCurrentlyCollapsed = currentSize <= this.target.collapseAt;

    console.log(
      "checking collapse condition",
      newSize,
      this.target.collapseTo,
      this.target.collapseAt,
      currentSize,
      isCurrentlyCollapsed
    );

    // If currently collapsed and trying to expand, snap to collapseAt
    if (isCurrentlyCollapsed && newSize > this.target.collapseTo) {
      console.log("expanding past collapse threshold");
      return this.target.sizeDefault;
    }

    // If new size would be below collapse threshold, collapse it
    if (newSize < this.target.collapseAt) {
      return this.target.collapseTo;
    }

    return newSize;
  }

  private calculateNewSize(deltaPx: number): number {
    if (!this.initialState) return this.target.size;

    const shouldInvertDelta =
      (this.target.direction === "column" && this.dividerPosition === "end") ||
      (this.target.direction === "row" && this.dividerPosition === "start");

    const baseDelta = shouldInvertDelta ? -deltaPx : deltaPx;
    const rawNewSize = this.initialState.target.size + baseDelta;

    // Apply basic constraints first
    const minSize = this.target.sizeMin || 0;
    const maxSize = this.target.sizeMax || Infinity;
    const clampedSize = GridResizeUtils.clamp(rawNewSize, minSize, maxSize);

    // Apply collapse logic only for px units
    if (this.target.sizeUnit === "px") {
      return this.checkCollapseCondition(
        clampedSize,
        this.initialState.target.size
      );
    }

    return clampedSize;
  }

  private startDragging(event: MouseEvent | TouchEvent): void {
    event.preventDefault();

    if (this.isDragging) return;

    this.isDragging = true;
    this.initialState = this.captureInitialState();
    this.startPosition = this.getEventPosition(event);

    // Add global event listeners
    document.addEventListener("mousemove", this.handleMouseMove);
    document.addEventListener("mouseup", this.handleMouseUp);
    document.addEventListener("touchmove", this.handleTouchMove);
    document.addEventListener("touchend", this.handleTouchEnd);

    // Prevent text selection during drag
    document.body.style.userSelect = "none";
  }

  private getEventPosition(event: MouseEvent | TouchEvent): number {
    if (event instanceof MouseEvent) {
      return event[this.target.clientAxis];
    } else {
      const touch = event.touches[0];
      return touch[this.target.clientAxis];
    }
  }

  private onDrag(event: MouseEvent | TouchEvent): void {
    if (!this.isDragging) return;

    event.preventDefault();

    const currentPosition = this.getEventPosition(event);
    const deltaPx = currentPosition - this.startPosition;

    this.applyResize(deltaPx);
  }

  private applyResize(deltaPx: number): void {
    const root = document.documentElement;

    if (this.target.sizeUnit === "px") {
      const newSize = this.calculateNewSize(deltaPx);
      root.style.setProperty(`--${this.target.id}-size`, `${newSize}px`);
    } else if (this.target.sizeUnit === "fr") {
      const frSiblings = this.siblings.filter(
        (sibling) => sibling.sizeUnit === "fr"
      );

      if (frSiblings.length > 0) {
        const gapsPx = this.siblings
          .filter((pane) => pane.type === "divider")
          .reduce((sum, pane) => sum + pane.sizePx, 0);

        const pxPanes = this.siblings
          .filter((pane) => pane.sizeUnit === "px")
          .reduce((sum, pane) => sum + pane.sizePx, 0);

        const flexPx = GridResizeUtils.getFlexSpacePx(
          this.container.sizePx,
          pxPanes,
          gapsPx
        );

        const adjustedDeltaPx =
          this.dividerPosition === "start" ? -deltaPx : deltaPx;

        // Simple pane data for fr distribution (no collapse info needed)
        const targetData = {
          id: this.target.id,
          size: this.target.size,
          sizeMin: this.target.sizeMin,
          sizeMax: this.target.sizeMax,
        };

        const frSiblingsData = frSiblings.map((sibling) => ({
          id: sibling.id,
          size: sibling.size,
          sizeMin: sibling.sizeMin,
          sizeMax: sibling.sizeMax,
        }));

        const newSizes = GridResizeUtils.distributeFrDelta(
          targetData,
          frSiblingsData,
          adjustedDeltaPx,
          flexPx
        );

        newSizes.forEach((pane) => {
          root.style.setProperty(`--${pane.id}-size`, `${pane.size}fr`);
        });
      }
    }
  }

  private onDragEnd(): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.initialState = null;

    // Remove global event listeners
    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("mouseup", this.handleMouseUp);
    document.removeEventListener("touchmove", this.handleTouchMove);
    document.removeEventListener("touchend", this.handleTouchEnd);

    // Restore text selection
    document.body.style.userSelect = "";
  }

  private reset(): void {
    const root = document.documentElement;

    // Reset target to default size
    const defaultValue =
      this.target.sizeUnit === "px"
        ? `${this.target.sizeDefault}px`
        : `${this.target.sizeDefault}fr`;

    root.style.setProperty(`--${this.target.id}-size`, defaultValue);

    // Reset siblings to default sizes
    this.siblings.forEach((sibling) => {
      if (sibling.sizeDefault && sibling.sizeUnit) {
        const siblingDefault =
          sibling.sizeUnit === "px"
            ? `${sibling.sizeDefault}px`
            : `${sibling.sizeDefault}fr`;

        root.style.setProperty(`--${sibling.id}-size`, siblingDefault);
      }
    });
  }

  public destroy(): void {
    this.element.removeEventListener("mousedown", this.handleMouseDown);
    this.element.removeEventListener("touchstart", this.handleTouchStart);
    this.element.removeEventListener("dblclick", this.handleDoubleClick);

    if (this.isDragging) {
      this.onDragEnd();
    }
  }
}

// Main Phoenix LiveView Hook
interface PhoenixHook {
  el: HTMLElement;
  mounted(): void;
  destroyed(): void;
}

const GridResize = {
  mounted(): void {
    try {
      const container = findParentGroup(this.el);
      const siblingElements = Array.from(container.el.children).filter(
        (sibling): sibling is HTMLElement =>
          sibling instanceof HTMLElement && sibling.hasAttribute("data-pane-id")
      );
      const root = this.el.closest("[data-pane-root-id]") as HTMLElement;

      const panes = siblingElements.map((sibling) => {
        const options: PaneOptions = {
          ...sibling.dataset,
          direction: container.direction,
        } as PaneOptions;
        return new Pane(sibling, options);
      });

      const target = panes.find(
        (pane) => pane.id === this.el.dataset.paneTarget
      );

      if (!target) {
        throw new Error(`Target pane not found: ${this.el.dataset.paneTarget}`);
      }

      console.log("root", root.dataset.paneRootId);

      this.divider = new Divider(this.el, target, panes, container);
    } catch (error) {
      console.error("Failed to initialize GridResize hook:", error);
    }
  },

  destroyed(): void {
    if (this.divider) {
      this.divider.destroy();
      this.divider = undefined;
    }
  },
};

export default GridResize;
