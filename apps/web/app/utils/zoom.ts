/** A point in CSS pixels, measured from the center of the zoom stage. */
export interface StagePoint {
  readonly x: number;
  readonly y: number;
}

/** Size of the zoom stage in CSS pixels, read when a gesture needs it (the stage follows the window). */
export interface StageSize {
  readonly width: number;
  readonly height: number;
}

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
/** Factor of one press of the zoom buttons or the + and - keys. */
export const ZOOM_STEP = 1.5;
/** Scale a double tap jumps to, enough to read a label on a compressor. */
export const ZOOM_TAP_SCALE = 2.5;
/** How far an arrow key moves the zoomed photo. */
export const ZOOM_PAN_STEP = 48;

const STAGE_CENTER: StagePoint = { x: 0, y: 0 };

function clampSymmetric(value: number, limit: number): number {
  // "|| 0" turns -0 into 0, so the transform never reads "-0px".
  return Math.min(limit, Math.max(-limit, value)) || 0;
}

/**
 * Scale and offset of a photo fitted inside the stage, with the transform origin at the stage center. Zooming keeps
 * the point under the fingers or the cursor still, and the offset never lets the photo leave an empty border.
 */
export class ZoomView {
  scale = ZOOM_MIN;
  x = 0;
  y = 0;

  constructor(private readonly measure: () => StageSize) {}

  get isZoomed(): boolean {
    return this.scale > ZOOM_MIN;
  }

  get canZoomIn(): boolean {
    return this.scale < ZOOM_MAX;
  }

  get percent(): number {
    return Math.round(this.scale * 100);
  }

  get transform(): string {
    return `translate3d(${this.x}px, ${this.y}px, 0) scale(${this.scale})`;
  }

  zoomBy(factor: number, focus: StagePoint = STAGE_CENTER): void {
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.scale * factor));
    const ratio = next / this.scale;
    this.x = focus.x - (focus.x - this.x) * ratio;
    this.y = focus.y - (focus.y - this.y) * ratio;
    this.scale = next;
    this.keepInside();
  }

  panBy(deltaX: number, deltaY: number): void {
    this.x += deltaX;
    this.y += deltaY;
    this.keepInside();
  }

  /** Double tap: zooms in on the tapped point, or back to the whole photo when already zoomed. */
  toggleAt(focus: StagePoint): void {
    if (this.isZoomed) this.reset();
    else this.zoomBy(ZOOM_TAP_SCALE, focus);
  }

  reset(): void {
    this.scale = ZOOM_MIN;
    this.x = 0;
    this.y = 0;
  }

  private keepInside(): void {
    const { width, height } = this.measure();
    this.x = clampSymmetric(this.x, ((this.scale - 1) * width) / 2);
    this.y = clampSymmetric(this.y, ((this.scale - 1) * height) / 2);
  }
}

/** Movement under which a pointer counts as a tap, not a drag. */
const TAP_SLOP = 10;
/** Two taps closer than this make a double tap. */
const DOUBLE_TAP_MS = 300;
/** Horizontal drag that changes the photo while it is not zoomed. */
const SWIPE_DISTANCE = 60;
/** Wheel sensitivity: one notch of a mouse wheel (about 100) zooms by roughly 20%. */
const WHEEL_SENSITIVITY = 0.002;

export type PhotoStep = 1 | -1;

interface ClientPoint {
  readonly clientX: number;
  readonly clientY: number;
}

interface PointerInput extends ClientPoint {
  readonly pointerId: number;
}

interface WheelInput extends ClientPoint {
  readonly deltaY: number;
}

export interface ZoomGestureOptions {
  readonly view: ZoomView;
  /** Screen rectangle of the stage, to turn client coordinates into stage points. */
  readonly stageBounds: () => DOMRectReadOnly;
  /** A swipe on the whole photo asks for the next (1) or the previous (-1) one. */
  readonly onSwipe: (step: PhotoStep) => void;
  readonly now?: () => number;
}

function distance(from: StagePoint, to: StagePoint): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function midpoint(from: StagePoint, to: StagePoint): StagePoint {
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

/**
 * Turns pointer events (touch, pen and mouse alike) into zoom actions: two fingers pinch, one finger or the mouse
 * drags the zoomed photo, a double tap toggles the zoom, a swipe changes the photo and the wheel zooms at the cursor.
 */
export class ZoomGestures {
  private readonly pointers = new Map<number, StagePoint>();
  private gestureStart: StagePoint | null = null;
  private lastTapAt = Number.NEGATIVE_INFINITY;
  private readonly now: () => number;

  constructor(private readonly options: ZoomGestureOptions) {
    this.now = options.now ?? Date.now;
  }

  down(event: PointerInput): void {
    const point = this.locate(event);
    this.pointers.set(event.pointerId, point);
    this.gestureStart = this.pointers.size === 1 ? point : null;
  }

  move(event: PointerInput): void {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    const point = this.locate(event);
    const partner = this.partnerOf(event.pointerId);
    if (partner) this.pinch(previous, point, partner);
    else if (this.options.view.isZoomed) this.options.view.panBy(point.x - previous.x, point.y - previous.y);
    this.pointers.set(event.pointerId, point);
  }

  up(event: PointerInput): void {
    if (!this.pointers.delete(event.pointerId)) return;
    const start = this.gestureStart;
    this.gestureStart = null;
    if (start) this.finishSingle(start, this.locate(event));
  }

  wheel(event: WheelInput): void {
    this.options.view.zoomBy(Math.exp(-event.deltaY * WHEEL_SENSITIVITY), this.locate(event));
  }

  private partnerOf(pointerId: number): StagePoint | undefined {
    return [...this.pointers].find(([id]) => id !== pointerId)?.[1];
  }

  private pinch(previous: StagePoint, point: StagePoint, partner: StagePoint): void {
    const factor = distance(point, partner) / Math.max(distance(previous, partner), 1);
    this.options.view.zoomBy(factor, midpoint(point, partner));
  }

  private finishSingle(start: StagePoint, end: StagePoint): void {
    const deltaX = end.x - start.x;
    if (distance(start, end) < TAP_SLOP) this.tap(end);
    else if (!this.options.view.isZoomed && Math.abs(deltaX) > SWIPE_DISTANCE)
      this.options.onSwipe(deltaX < 0 ? 1 : -1);
  }

  private tap(point: StagePoint): void {
    const time = this.now();
    const isDouble = time - this.lastTapAt < DOUBLE_TAP_MS;
    this.lastTapAt = isDouble ? Number.NEGATIVE_INFINITY : time;
    if (isDouble) this.options.view.toggleAt(point);
  }

  private locate(event: ClientPoint): StagePoint {
    const bounds = this.options.stageBounds();
    return {
      x: event.clientX - bounds.left - bounds.width / 2,
      y: event.clientY - bounds.top - bounds.height / 2,
    };
  }
}

type KeyAction = (view: ZoomView, navigate: (step: PhotoStep) => void) => void;

function arrowAction(deltaX: number, deltaY: number, step: PhotoStep | null): KeyAction {
  return (view, navigate) => {
    if (view.isZoomed) view.panBy(deltaX, deltaY);
    else if (step) navigate(step);
  };
}

const zoomIn: KeyAction = (view) => view.zoomBy(ZOOM_STEP);
const zoomOut: KeyAction = (view) => view.zoomBy(1 / ZOOM_STEP);

/** Keyboard of the viewer: + and - zoom, 0 restores, arrows move the zoomed photo or change the photo. */
const KEY_ACTIONS: ReadonlyMap<string, KeyAction> = new Map<string, KeyAction>([
  ['+', zoomIn],
  ['=', zoomIn],
  ['-', zoomOut],
  ['0', (view) => view.reset()],
  ['ArrowLeft', arrowAction(ZOOM_PAN_STEP, 0, -1)],
  ['ArrowRight', arrowAction(-ZOOM_PAN_STEP, 0, 1)],
  ['ArrowUp', arrowAction(0, ZOOM_PAN_STEP, null)],
  ['ArrowDown', arrowAction(0, -ZOOM_PAN_STEP, null)],
]);

/** Runs the action of a key and tells whether the viewer used it, so the caller can stop the page default. */
export function handleZoomKey(key: string, view: ZoomView, navigate: (step: PhotoStep) => void): boolean {
  const action = KEY_ACTIONS.get(key);
  action?.(view, navigate);
  return action !== undefined;
}
