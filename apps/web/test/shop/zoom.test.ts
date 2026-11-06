import { describe, expect, it, vi } from 'vitest';
import {
  handleZoomKey,
  ZOOM_MAX,
  ZOOM_PAN_STEP,
  ZOOM_STEP,
  ZOOM_TAP_SCALE,
  ZoomGestures,
  ZoomView,
  type PhotoStep,
} from '~/utils/zoom';

const STAGE = { left: 100, top: 50, width: 400, height: 300 } as DOMRectReadOnly;

function stageView(): ZoomView {
  return new ZoomView(() => STAGE);
}

/** Client coordinates of a point given relative to the stage center. */
function at(x: number, y: number, pointerId = 1) {
  return { pointerId, clientX: STAGE.left + STAGE.width / 2 + x, clientY: STAGE.top + STAGE.height / 2 + y };
}

function gesturesOn(view: ZoomView, clock = { time: 0 }) {
  const onSwipe = vi.fn<(step: PhotoStep) => void>();
  const gestures = new ZoomGestures({ view, stageBounds: () => STAGE, onSwipe, now: () => clock.time });
  return { gestures, onSwipe, clock };
}

function tap(gestures: ZoomGestures, x: number, y: number): void {
  gestures.down(at(x, y));
  gestures.up(at(x, y));
}

describe('ZoomView', () => {
  it('zooms around a point, stays inside the stage and between the limits', () => {
    const view = stageView();
    expect(view.isZoomed).toBe(false);
    expect(view.transform).toBe('translate3d(0px, 0px, 0) scale(1)');
    view.zoomBy(2, { x: 100, y: 50 });
    expect([view.scale, view.x, view.y]).toEqual([2, -100, -50]);
    expect(view.isZoomed).toBe(true);
    expect(view.percent).toBe(200);
    view.panBy(1000, -1000);
    expect([view.x, view.y]).toEqual([200, -150]);
    view.zoomBy(10);
    expect(view.scale).toBe(ZOOM_MAX);
    expect(view.canZoomIn).toBe(false);
    view.zoomBy(0.01);
    expect([view.scale, view.x, view.y]).toEqual([1, 0, 0]);
  });

  it('toggles the double tap zoom and resets', () => {
    const view = stageView();
    view.toggleAt({ x: 0, y: 0 });
    expect(view.scale).toBe(ZOOM_TAP_SCALE);
    view.toggleAt({ x: 10, y: 10 });
    expect(view.scale).toBe(1);
  });
});

describe('ZoomGestures', () => {
  it('pinches with two fingers and drags with one', () => {
    const view = stageView();
    const { gestures } = gesturesOn(view);
    gestures.down(at(-50, 0, 1));
    gestures.down(at(50, 0, 2));
    gestures.move(at(-100, 0, 1));
    expect(view.scale).toBeCloseTo(1.5);
    gestures.up(at(-100, 0, 1));
    const { x } = view;
    gestures.move(at(40, 0, 2));
    expect(view.x).toBe(Math.max(x - 10, -100));
    gestures.up(at(40, 0, 2));
    gestures.move(at(0, 0, 3));
    gestures.up(at(0, 0, 3));
    expect(view.scale).toBeCloseTo(1.5);
  });

  it('ignores a one finger drag while the photo is whole, but swipes to the next or previous photo', () => {
    const view = stageView();
    const { gestures, onSwipe } = gesturesOn(view);
    gestures.down(at(0, 0));
    gestures.move(at(-30, 0));
    expect(view.x).toBe(0);
    gestures.up(at(-100, 0));
    gestures.down(at(0, 0));
    gestures.up(at(100, 0));
    gestures.down(at(0, 0));
    gestures.up(at(30, 0));
    expect(onSwipe.mock.calls).toEqual([[1], [-1]]);
    view.zoomBy(2);
    gestures.down(at(0, 0));
    gestures.up(at(-100, 0));
    expect(onSwipe).toHaveBeenCalledTimes(2);
  });

  it('toggles the zoom on a double tap only', () => {
    const view = stageView();
    const { gestures, clock } = gesturesOn(view);
    tap(gestures, 20, 0);
    clock.time = 500;
    tap(gestures, 20, 0);
    expect(view.isZoomed).toBe(false);
    clock.time = 600;
    tap(gestures, 20, 0);
    expect(view.scale).toBe(ZOOM_TAP_SCALE);
    clock.time = 700;
    tap(gestures, 20, 0);
    expect(view.isZoomed).toBe(true);
  });

  it('zooms with the wheel at the cursor and uses the real clock by default', () => {
    const view = stageView();
    const gestures = new ZoomGestures({ view, stageBounds: () => STAGE, onSwipe: vi.fn() });
    gestures.wheel({ ...at(0, 0), deltaY: -100 });
    expect(view.scale).toBeCloseTo(Math.exp(0.2));
    gestures.wheel({ ...at(0, 0), deltaY: 1000 });
    expect(view.scale).toBe(1);
    tap(gestures, 0, 0);
    tap(gestures, 0, 0);
    expect(view.isZoomed).toBe(true);
  });
});

describe('handleZoomKey', () => {
  it('zooms with + and -, restores with 0 and ignores other keys', () => {
    const view = stageView();
    const navigate = vi.fn();
    expect(handleZoomKey('+', view, navigate)).toBe(true);
    expect(view.scale).toBe(ZOOM_STEP);
    handleZoomKey('=', view, navigate);
    handleZoomKey('-', view, navigate);
    expect(view.scale).toBeCloseTo(ZOOM_STEP);
    handleZoomKey('0', view, navigate);
    expect(view.scale).toBe(1);
    expect(handleZoomKey('a', view, navigate)).toBe(false);
    expect(handleZoomKey('constructor', view, navigate)).toBe(false);
  });

  it('changes the photo with the side arrows, or moves the zoomed photo', () => {
    const view = stageView();
    const navigate = vi.fn();
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) handleZoomKey(key, view, navigate);
    expect(navigate.mock.calls).toEqual([[-1], [1]]);
    view.zoomBy(3);
    handleZoomKey('ArrowRight', view, navigate);
    handleZoomKey('ArrowDown', view, navigate);
    expect([view.x, view.y]).toEqual([-ZOOM_PAN_STEP, -ZOOM_PAN_STEP]);
    handleZoomKey('ArrowLeft', view, navigate);
    handleZoomKey('ArrowUp', view, navigate);
    expect([view.x, view.y]).toEqual([0, 0]);
    expect(navigate).toHaveBeenCalledTimes(2);
  });
});
