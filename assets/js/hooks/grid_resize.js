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

  // ---------- 3. emit the new template string ----------
  return panes.map(pane => `${pane.fr}fr`).join(' ');
}


function measureElement(element, direction) {
  const rect = element.getBoundingClientRect();
  if (direction === "row") {
    return {size: rect.height, direction: direction};
  } else {
    return {size: rect.width, direction: direction};
  }
}

class Pane {
  constructor(el, options) {
    this.el = el;
    this.id = getAttribute(options, "paneId");
    this.type = getAttribute(options, "paneType");
    this.direction = getAttribute(options, "paneDirection");
    this.target = getAttribute(options, "paneTarget");
    this.defaultSize = Number(getAttribute(options, "paneDefaultSize"));
    this.sizeUnit = getAttribute(options, "paneSizeUnit");
    this.dimensions = measureElement(this.el, this.direction);
  }

  getSizePx() {
    return this.dimensions.size;
  }

  getSizeFr() {
    return this.dimensions.size / this.sizeUnit;
  }
}

const GridResize = {
  mounted() {
    console.log("GridResize mounted");
    const direction = this.el.getAttribute("data-direction");
    const parentElement = this.el.parentElement;
    const container = measureElement(parentElement, direction);

    // console.log("ContainerPx:", container.size);
    // const flexPx = getFlexSpacePx(container.size, 0, 0);

    // console.log("FlexPx:", flexPx);

    // Get only the siblings (excluding the element itself)
    const siblings =  Array.from(parentElement.children).filter(sibling => sibling.hasAttribute("data-pane-id"));
    siblings.forEach(sibling => {
      const pane = new Pane(sibling, sibling.dataset);
      console.log("Pane:", pane);
    });
  },
};

export default GridResize;