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
  // Create working copies to avoid mutating original panes
  const workingPanes = panes.map(pane => ({
    id: pane.id,
    size: pane.size,
    sizeMin: pane.sizeMin || 0,
    sizeMax: pane.sizeMax || Infinity,
  }));
  
  const totalFr = workingPanes.reduce((acc, pane) => acc + pane.size, 0);
  const ppf     = pxPerFr(flexPx, totalFr);      
  let   deltaFr = deltaPx / ppf;                

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  // ---------- 1. try to apply Δ to the dragged column ----------
  const pane   = workingPanes[idx];
  const minFr = pane.sizeMin / ppf;                  
  const maxFr = pane.sizeMax === Infinity ? Infinity : pane.sizeMax / ppf;

  const proposedFr = clamp(pane.size + deltaFr, minFr, maxFr);
  const appliedFr  = proposedFr - pane.size;       
  pane.size        += appliedFr;
  let leftoverFr    = deltaFr - appliedFr;      

  // ---------- 2. iterative sibling redistribution ----------
  const EPS = 1e-4;
  while (Math.abs(leftoverFr) > EPS) {
    const candidates = workingPanes.filter((pane, i) => {
      if (i === idx) return false;
      if (leftoverFr > 0) {                     
        return pane.size - pane.sizeMin / ppf > EPS;
      }                                         
      return (pane.sizeMax === Infinity) || (pane.sizeMax / ppf - pane.size > EPS);
    });

    if (!candidates.length) break;              

    const totalRoomFr = candidates.reduce((sum, pane) => {
      return sum + (leftoverFr > 0
        ? (pane.size - pane.sizeMin / ppf)                  
        : ((pane.sizeMax === Infinity ? Infinity : pane.sizeMax / ppf) - pane.size));
    }, 0);

    for (const c of candidates) {
      const roomFr = leftoverFr > 0
        ? (c.size - c.sizeMin / ppf)
        : ((c.sizeMax === Infinity ? Infinity : c.sizeMax / ppf) - c.size);

      let shareFr = leftoverFr * (roomFr / totalRoomFr);
      shareFr     = clamp(shareFr, -roomFr, roomFr);
      c.size       -= shareFr;
      leftoverFr -= shareFr;
    }
  }

  return workingPanes.map(pane => {
    return {
      id: pane.id,
      size: pane.size,
    }
  })
}

function distributeFrDeltaSimple(target, frSiblings, deltaPx) {
  // get the pixel size of the target Pane object
  // calculate the % change of applying the deltaPx to the target
  // apply the % change to all the frSiblings which are an array of Pane objects
  // return the new sizes

  const targetSizePx = target.sizePx;
  const targetSizeFr = target.size;

  const deltaFr = deltaPx / targetSizePx;

  const newSizes = frSiblings.map(sibling => {
    return {
      id: sibling.id,
      size: sibling.size + deltaFr,
    }
  })

  return newSizes;
}

class Pane {
  constructor(el, options) {
    this.el = el;
    this.id = getAttribute(options, "paneId");
    this.type = getAttribute(options, "paneType");
    this.target = getAttribute(options, "paneTarget");
    this.sizeDefault = Number(getAttribute(options, "paneSizeDefault"));
    this.sizeMin = Number(getAttribute(options, "paneSizeMin"));
    this.sizeMax = Number(getAttribute(options, "paneSizeMax"));
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

    if (this.direction === 'row') {
        this.start = top
        this.end = bottom
        this.size = this.sizing(height, this.sizeUnit)
        this.sizePx = height
        this.clientAxis = 'clientY'
    } else if (this.direction === 'column') {
        this.start = left
        this.end = right
        this.size = this.sizing(width, this.sizeUnit)
        this.sizePx = width
        this.clientAxis = 'clientX'
    }
  }

  sizing(size, unit) {
    if (unit === 'px') {
      return size;
    } else if (unit === 'fr') {
      return this.getCurrentFrValue();
    }
  }

  getCurrentFrValue() {    
    const root = document.documentElement;
    const value = getComputedStyle(root).getPropertyValue(`--${this.id}-size`);

    console.log("Value:", parseFloat(value.replace('fr', '')));
    console.log("SizeDefault:", this.sizeDefault);
    return parseFloat(value.replace('fr', '')) || this.sizeDefault;
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
    this.dividerPosition = element.dataset.paneDividerPosition;
    
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
        position: sibling.start
      })),
      container: {
        size: this.container.size,
      }
    };
  }

  resize(deltaPx) {
    let newSize;
    let minSize, maxSize;

    // Calculate the new size based on divider position
    if (this.dividerPosition === "start") {
      newSize = this.initialState.target.size - deltaPx;
      minSize = this.target.sizeMin || 0;
      maxSize = this.target.sizeMax || Infinity;
    } else {
      newSize = this.initialState.target.size + deltaPx;
      minSize = this.target.sizeMin || 0;
      maxSize = this.target.sizeMax || Infinity;
    }
    
    // Apply clamping
    return Math.max(minSize, Math.min(maxSize, newSize));
  }
  
  startDragging(event) {
    event.preventDefault();

    console.log("StartDragging");
    
    if (this.isDragging) return;
    
    this.isDragging = true;
    this.initialState = this.captureInitialState();
    this.startPosition = event[this.target.clientAxis];
    
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
    
    const currentPosition = event[this.target.clientAxis];
    const deltaPx = currentPosition - this.startPosition;
    
    this.applyResize(deltaPx);
  }
  
  applyResize(deltaPx) {
    const root = document.documentElement;
    
    if (this.target.sizeUnit === 'px') {
      const newSize = this.resize(deltaPx);
      root.style.setProperty(`--${this.target.id}-size`, `${newSize}px`);
      
    } else if (this.target.sizeUnit === 'fr') {
      const frSiblings = this.siblings.filter(sibling => sibling.sizeUnit === 'fr');
      
      if (frSiblings.length > 0) {      
        const allFrPanes = [this.target, ...frSiblings.filter(pane => pane.id !== this.target.id)];
        
        const gapsPx = this.siblings.filter(pane => pane.type === "divider")
          .map(pane => pane.sizePx).reduce((a, b) => a + b, 0);
        const pxPanes = this.siblings.filter(pane => pane.sizeUnit === "px")
          .map(pane => pane.sizePx).reduce((a, b) => a + b, 0);
        const flexPx = getFlexSpacePx(this.container.sizePx, pxPanes, gapsPx);

        const idx = allFrPanes.findIndex(pane => pane.id === this.target.id);
        
        // Adjust deltaPx based on divider position
        const adjustedDeltaPx = this.dividerPosition === "start" ? -deltaPx : deltaPx;

        console.log("Original deltaPx:", deltaPx);
        console.log("Adjusted deltaPx:", adjustedDeltaPx);
        console.log("Divider position:", this.dividerPosition);

        const newSizes = distributeFrDelta(allFrPanes, idx, adjustedDeltaPx, flexPx);
        
        newSizes.forEach((pane) => {
          root.style.setProperty(`--${pane.id}-size`, `${pane.size}fr`);
        });
        
      } else {
        // Target is fr but no fr siblings - treat as simple resize
        const totalFr = this.target.size; // Use size directly since it contains fr value
        const flexPx = getFlexSpacePx(this.container.sizePx, 0, 0); // Simplified
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
      return new Pane(sibling, options);
    });

    const target = panes.find(pane => pane.id === this.el.dataset.paneTarget);
    
    // Create the divider tracker
    this.divider = new Divider(this.el, target, panes, container);
  },
  
  destroyed() {
    // Clean up when the hook is destroyed
    if (this.divider) {
      this.divider.destroy();
    }
  }
};

export default GridResize;