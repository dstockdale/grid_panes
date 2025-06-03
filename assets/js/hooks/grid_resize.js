function getFlexSpacePx(containerPx, fixedTrackPx, gapsPx) {
  return containerPx - fixedTrackPx - gapsPx;
}

function pxPerFr(flexSpacePx, totalFr) {
  return flexSpacePx / totalFr;           // constant as long as Σfr stays the same
}

function getAttribute(object, attribute, defaultValue = null) {
  return object[attribute] || defaultValue;
}

/**
 * Resize one fr-column and push the opposite Δ onto siblings,
 * all in fr units.
 *
 * @param {Pane[]} panes      – live column state
 * @param {number} idx      – index of the dragged column
 * @param {number} deltaPx  – pixel delta reported by the drag
 * @param {number} flexPx   – total flex space in px
 */
function distributeFrDelta(panes, idx, deltaPx, flexPx) {
  const totalFr = panes.reduce((s, c) => s + c.fr, 0);
  const ppf     = pxPerFr(flexPx, totalFr);      // px per 1fr right now
  let   deltaFr = deltaPx / ppf;                // convert gesture into fr units

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  // ---------- 1. try to apply Δ to the dragged column ----------
  const pane   = panes[idx];
  const minFr = pane.min / ppf;                  // pixel limits → fr limits
  const maxFr = pane.max === Infinity ? Infinity : pane.max / ppf;

  const proposedFr = clamp(pane.fr + deltaFr, minFr, maxFr);
  const appliedFr  = proposedFr - pane.fr;       // may be ⩽ |deltaFr|
  pane.fr          += appliedFr;
  let leftoverFr    = deltaFr - appliedFr;      // what the siblings must absorb

  // ---------- 2. iterative sibling redistribution ----------
  const EPS = 1e-4;
  while (Math.abs(leftoverFr) > EPS) {
    const candidates = panes.filter((pane, i) => {
      if (i === idx) return false;
      if (leftoverFr > 0) {                     // need to SHRINK others
        return pane.fr - pane.min / ppf > EPS;
      }                                         // need to GROW others
      return (pane.max === Infinity) || (pane.max / ppf - pane.fr > EPS);
    });

    if (!candidates.length) break;              // layout saturated

    const totalRoomFr = candidates.reduce((sum, pane) => {
      return sum + (leftoverFr > 0
        ? (pane.fr - pane.min / ppf)                  // shrink room
        : ((pane.max === Infinity ? Infinity : pane.max / ppf) - pane.fr)); // grow room
    }, 0);

    for (const c of candidates) {
      const roomFr = leftoverFr > 0
        ? (c.fr - c.min / ppf)
        : ((c.max === Infinity ? Infinity : c.max / ppf) - c.fr);

      let shareFr = leftoverFr * (roomFr / totalRoomFr);
      shareFr     = clamp(shareFr, -roomFr, roomFr);
      c.fr       -= shareFr;
      leftoverFr -= shareFr;
    }
  }

  console.log("Panes:", panes);

  return panes.map(pane => `${pane.fr}fr`).join(' ');
}

class Pane {
  constructor(el, options) {
    this.el = el;
    this.id = getAttribute(options, "paneId");
    this.type = getAttribute(options, "paneType");
    this.target = getAttribute(options, "paneTarget");
    this.sizeDefault = Number(getAttribute(options, "paneSizeDefault"));
    this.sizeMinStart = Number(getAttribute(options, "paneMinStart"));
    this.sizeMaxStart = Number(getAttribute(options, "paneMaxStart"));
    this.sizeMinEnd = Number(getAttribute(options, "paneMinEnd"));
    this.sizeMaxEnd = Number(getAttribute(options, "paneMaxEnd"));
    this.sizeUnit = getAttribute(options, "paneSizeUnit");
    this.direction = getAttribute(options, "paneDirection", options["direction"]);
    this.getDimensions();

    if (this.type === "divider") {
      this.el.addEventListener('mousedown', this.startDragging)
      this.el.addEventListener('touchstart', this.startDragging)
    }
  }

  getDimensions() {
    const {
        width,
        height,
        top,
        bottom,
        left,
        right,
    } = this.el.getBoundingClientRect()

    if (this.direction === 'column') {
        this.start = top
        this.end = bottom
        this.size = height
        this.clientAxis = 'clientX'
    } else if (this.direction === 'row') {
        this.start = left
        this.end = right
        this.size = width
        this.clientAxis = 'clientY'
    }
  }
}

function findParentGroup(element) {
  let parent = element.parentElement;
  while (parent) {
    if (parent.dataset.paneType === "group") {
      return new Pane(parent, parent.dataset);
    } else {
      throw new Error("Parent is not a group");
    }
  }
}

class Divider {
  constructor(element, target, siblings, container) {
    this.element = element;
    this.target = target;
    this.siblings = siblings;
    this.container = container;
    
    this.isDragging = false;
    this.initialState = null;
    
    // Bind methods
    this.startDragging = this.startDragging.bind(this);
    this.onDrag = this.onDrag.bind(this);
    this.onDragEnd = this.onDragEnd.bind(this);
    this.reset = this.reset.bind(this);
    
    // Set up event listeners
    this.element.addEventListener('mousedown', this.startDragging);
    this.element.addEventListener('touchstart', this.startDragging);
    this.element.addEventListener('dblclick', this.reset);
  }
  
  captureInitialState() {
    // Refresh dimensions for all panes
    this.target.getDimensions();
    this.siblings.forEach(sibling => sibling.getDimensions());
    this.container.getDimensions();
    
    return {
      target: {
        size: this.target.size,
        position: this.target.start,
      },
      siblings: this.siblings.map(sibling => ({
        id: sibling.id,
        size: sibling.size,
        position: sibling.start,
        fr: sibling.sizeUnit === 'fr' ? this.getCurrentFrValue(sibling) : null,
      })),
      container: {
        size: this.container.size,
      }
    };
  }
  
  getCurrentFrValue(pane) {
    // Get current fr value from CSS custom property
    const root = document.documentElement;
    const value = getComputedStyle(root).getPropertyValue(`--${pane.id}`);
    return parseFloat(value.replace('fr', '')) || pane.sizeDefault;
  }
  
  startDragging(event) {
    event.preventDefault();

    console.log("StartDragging");
    
    if (this.isDragging) return;
    
    this.isDragging = true;
    this.initialState = this.captureInitialState();
    this.startPosition = this.target.direction === 'column' ? event.clientY : event.clientX;
    
    // Add global event listeners
    document.addEventListener('mousemove', this.onDrag);
    document.addEventListener('mouseup', this.onDragEnd);
    document.addEventListener('touchmove', this.onDrag);
    document.addEventListener('touchend', this.onDragEnd);
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
  }
  
  onDrag(event) {
    if (!this.isDragging) return;
    
    event.preventDefault();
    
    const currentPosition = this.target.direction === 'column' ? event.clientY : event.clientX;
    const deltaPx = currentPosition - this.startPosition;
    
    this.applyResize(deltaPx);
  }
  
  applyResize(deltaPx) {
    const root = document.documentElement;
    
    if (this.target.sizeUnit === 'px') {
      // Simple pixel-based resize
      const newSize = Math.max(
        this.target.sizeMinStart || 0,
        Math.min(
          this.target.sizeMaxStart || Infinity,
          this.initialState.target.size + deltaPx
        )
      );

      console.log("NewSize:", newSize);
      
      root.style.setProperty(`--${this.target.id}-size`, `${newSize}px`);
      
    } else if (this.target.sizeUnit === 'fr') {
      // Check if we have fr siblings that need distribution
      const frSiblings = this.siblings.filter(sibling => sibling.sizeUnit === 'fr');
      
      if (frSiblings.length > 0) {
        // Use distributeFrDelta for fr-based resizing
        const allFrPanes = [this.target, ...frSiblings];
        
        // Calculate flex space
        const gapsPx = this.siblings.filter(pane => pane.type === "divider")
          .map(pane => pane.size).reduce((a, b) => a + b, 0);
        const pxPanes = this.siblings.filter(pane => pane.sizeUnit === "px")
          .map(pane => pane.size).reduce((a, b) => a + b, 0);
        const flexPx = getFlexSpacePx(this.container.size, pxPanes, gapsPx);
        
        // Create a working copy with current fr values
        const workingPanes = allFrPanes.map(pane => ({
          ...pane,
          fr: this.getCurrentFrValue(pane),
          min: pane.sizeMinStart || 0,
          max: pane.sizeMaxStart || Infinity,
        }));
        
        const targetIndex = workingPanes.findIndex(pane => pane.id === this.target.id);
        const newTemplate = distributeFrDelta(workingPanes, targetIndex, deltaPx, flexPx);
        
        // Apply the new fr values
        const frValues = newTemplate.split(' ');
        workingPanes.forEach((pane, index) => {
          root.style.setProperty(`--${pane.id}-size`, frValues[index]);
        });
        
      } else {
        // Target is fr but no fr siblings - treat as simple resize
        const totalFr = this.getCurrentFrValue(this.target);
        const flexPx = getFlexSpacePx(this.container.size, 0, 0); // Simplified
        const ppf = pxPerFr(flexPx, totalFr);
        const deltaFr = deltaPx / ppf;
        const newFr = Math.max(0.1, totalFr + deltaFr); // Minimum 0.1fr
        
        root.style.setProperty(`--${this.target.id}-size`, `${newFr}fr`);
      }
    }
  }
  
  onDragEnd() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.initialState = null;
    
    // Remove global event listeners
    document.removeEventListener('mousemove', this.onDrag);
    document.removeEventListener('mouseup', this.onDragEnd);
    document.removeEventListener('touchmove', this.onDrag);
    document.removeEventListener('touchend', this.onDragEnd);
    
    // Restore text selection
    document.body.style.userSelect = '';
  }
  
  reset() {
    const root = document.documentElement;

    console.log("Reset", this.target);
    
    // Reset target to default size
    const defaultValue = this.target.sizeUnit === 'px' 
      ? `${this.target.sizeDefault}px`
      : `${this.target.sizeDefault}fr`;
    
    root.style.setProperty(`--${this.target.id}-size`, defaultValue);
    
    // Reset siblings to their defaults if they exist
    this.siblings.forEach(sibling => {
      if (sibling.sizeDefault && sibling.sizeUnit) {
        const siblingDefault = sibling.sizeUnit === 'px'
          ? `${sibling.sizeDefault}px`
          : `${sibling.sizeDefault}fr`;
        
        root.style.setProperty(`--${sibling.id}-size`, siblingDefault);
      }
    });
  }
  
  destroy() {
    // Clean up event listeners
    this.element.removeEventListener('mousedown', this.startDragging);
    this.element.removeEventListener('touchstart', this.startDragging);
    this.element.removeEventListener('dblclick', this.reset);
    
    if (this.isDragging) {
      this.onDragEnd();
    }
  }
}

const GridResize = {
  mounted() {
    const container = findParentGroup(this.el);
    const siblings = Array.from(container.el.children).filter(sibling => sibling.hasAttribute("data-pane-id"));
    const panes = siblings.map(sibling => {
      const options = {
        ...sibling.dataset,
        direction: container.direction,
      };

      console.log(options);
      return new Pane(sibling, options);
    });

    const panesMap = new Map();
    panes.forEach(pane => {
      panesMap.set(pane.id, pane);
    });

    const target = panesMap.get(this.el.dataset.paneTarget);
    const siblingPanes = panes.filter(pane => pane.id !== target.id);

    console.log("Target:", target);
    
    // Create the divider tracker
    this.divider = new Divider(this.el, target, siblingPanes, container);
  },
  
  destroyed() {
    // Clean up when the hook is destroyed
    if (this.divider) {
      this.divider.destroy();
    }
  }
};

export default GridResize;