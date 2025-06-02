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

  return panes.map(pane => `${pane.fr}fr`).join(' ');
}

class Pane {
  constructor(el, options) {
    this.el = el;
    this.id = getAttribute(options, "paneId");
    this.type = getAttribute(options, "paneType");
    this.target = getAttribute(options, "paneTarget");
    this.sizeDefault = Number(getAttribute(options, "paneDefaultSize"));
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

const GridResize = {
  mounted() {
    const container = findParentGroup(this.el);
    const siblings =  Array.from(container.el.children).filter(sibling => sibling.hasAttribute("data-pane-id"));
    const panes = siblings.map(sibling => {
      const options = {
        ...sibling.dataset,
        direction: container.direction,
      };

      return new Pane(sibling, options);
    });

    const gapsPx = panes.filter(pane => pane.type === "divider").map(pane => pane.size).reduce((a, b) => a + b, 0);
    const pxPanes = panes.filter(pane => pane.sizeUnit === "px").map(pane => pane.size).reduce((a, b) => a + b, 0);
    const frPanes = panes.filter(pane => pane.sizeUnit === "fr").map(pane => pane.size).reduce((a, b) => a + b, 0);

    const flexPx = getFlexSpacePx(container.size, pxPanes, gapsPx);
    const ppf = pxPerFr(flexPx, frPanes);

    const panesMap = new Map();
    panes.forEach(pane => {
      panesMap.set(pane.id, pane);
    });
    console.log("PanesMap:", panesMap);

    const target = panesMap.get(this.el.dataset.paneTarget);
    console.log("Target:", target);
    const sibs = siblings.filter(pane => pane.id !== target.id);
    

    console.log("Sibs:", sibs);

    console.log("Target:", this.el.dataset);
    console.log("Divider:", this.el.id);


    // const newSizes = distributeFrDelta(sibs, target, 0, flexPx);
    // console.log("NewSizes:", newSizes);

    console.log("Panes:", ppf);
    console.log("GapsPx:", gapsPx);
    console.log("PxPanes:", pxPanes);
    console.log("FrPanes:", frPanes);
    console.log("FlexPx:", flexPx);
    console.log("PPF:", ppf);

    // const pxPanes = panes.filter(pane => pane.sizeUnit === "px").map(pane => pane.size);
    // const frPanes = panes.filter(pane => pane.sizeUnit === "fr").map(pane => pane.size);

    // const flexPx = getFlexSpacePx(container.size, pxPanes.reduce((a, b) => a + b, 0), gaps.reduce((a, b) => a + b, 0));

    // const totalFr = frPanes.reduce((a, b) => a + b, 0);
    // const ppf = pxPerFr(flexPx, totalFr);

    // const newSizes = distributeFrDelta(panes, 0, 0, flexPx);
    // console.log("NewSizes:", newSizes);

  },
};

export default GridResize;