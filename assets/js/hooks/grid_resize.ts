// Types and Interfaces
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
      "paneResizeDirection",
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
      // Two-pane resizing: only affect the target and one adjacent pane
      const frSiblings = this.siblings.filter(
        (sibling) => sibling.sizeUnit === "fr"
      );

      if (frSiblings.length > 0) {
        const adjacentPane = this.findAdjacentPane(frSiblings);
        if (!adjacentPane) return; // No valid adjacent pane found

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

        const totalFr = frSiblings.reduce((acc, pane) => acc + pane.size, 0);
        const ppf = flexPx / totalFr; // pixels per fr unit
        const deltaFr = deltaPx / ppf; // Convert pixel delta to fr delta

        // Determine which pane grows and which shrinks based on divider position
        let targetDelta: number;
        let adjacentDelta: number;

        if (this.dividerPosition === "start") {
          // Divider is at start of target: dragging right/down grows target, shrinks adjacent
          targetDelta = deltaFr;
          adjacentDelta = -deltaFr;
        } else {
          // Divider is at end of target: dragging right/down shrinks target, grows adjacent
          targetDelta = -deltaFr;
          adjacentDelta = deltaFr;
        }

        // Apply constraints
        const newTargetSize = Math.max(
          (this.target.sizeMin || 0) / ppf,
          Math.min(
            this.target.sizeMax === Infinity
              ? Infinity
              : (this.target.sizeMax || Infinity) / ppf,
            this.target.size + targetDelta
          )
        );

        const newAdjacentSize = Math.max(
          (adjacentPane.sizeMin || 0) / ppf,
          Math.min(
            adjacentPane.sizeMax === Infinity
              ? Infinity
              : (adjacentPane.sizeMax || Infinity) / ppf,
            adjacentPane.size + adjacentDelta
          )
        );

        // Only apply changes if both panes can accommodate the change
        const actualTargetDelta = newTargetSize - this.target.size;
        const actualAdjacentDelta = newAdjacentSize - adjacentPane.size;

        // Ensure zero-sum: if one pane hits a constraint, limit the other's change
        if (Math.abs(actualTargetDelta + actualAdjacentDelta) > 0.001) {
          // One pane hit constraint, so adjust the deltas to maintain zero-sum
          if (Math.abs(actualTargetDelta) < Math.abs(targetDelta)) {
            // Target hit constraint, adjust adjacent
            const constrainedAdjacentSize =
              adjacentPane.size - actualTargetDelta;
            root.style.setProperty(
              `--${this.target.id}-size`,
              `${newTargetSize}fr`
            );
            root.style.setProperty(
              `--${adjacentPane.id}-size`,
              `${constrainedAdjacentSize}fr`
            );
          } else {
            // Adjacent hit constraint, adjust target
            const constrainedTargetSize =
              this.target.size - actualAdjacentDelta;
            root.style.setProperty(
              `--${this.target.id}-size`,
              `${constrainedTargetSize}fr`
            );
            root.style.setProperty(
              `--${adjacentPane.id}-size`,
              `${newAdjacentSize}fr`
            );
          }
        } else {
          // Both panes can accommodate the change
          root.style.setProperty(
            `--${this.target.id}-size`,
            `${newTargetSize}fr`
          );
          root.style.setProperty(
            `--${adjacentPane.id}-size`,
            `${newAdjacentSize}fr`
          );
        }
      }
    }
  }

  /**
   * Find the pane adjacent to the target based on divider position
   */
  private findAdjacentPane(frSiblings: Pane[]): Pane | null {
    const targetIndex = frSiblings.findIndex(
      (pane) => pane.id === this.target.id
    );
    if (targetIndex === -1) return null;

    if (this.dividerPosition === "start") {
      // Divider is at start of target, so adjacent pane is the previous one
      return targetIndex > 0 ? frSiblings[targetIndex - 1] : null;
    } else {
      // Divider is at end of target, so adjacent pane is the next one
      return targetIndex < frSiblings.length - 1
        ? frSiblings[targetIndex + 1]
        : null;
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
