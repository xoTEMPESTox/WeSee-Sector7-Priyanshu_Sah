import { Middleware } from "polymatic";

export interface FrameLoopEvent {
  dt: number;
  now: number;
}

/**
 * Implements fixed-time game loop. It sends frame-loop event to all middlewares in each frame.
 */
export class NodeFrameLoop extends Middleware {
  timeStep = 1000 / 20;
  interval: any;

  // reuse object
  event: FrameLoopEvent = {
    dt: 0,
    now: 0,
  };

  constructor() {
    super();
    this.on("activate", this.handleActivate);
    this.on("deactivate", this.handleDeactivate);
  }

  handleActivate() {
    this.interval = setInterval(this.handleFrame, this.timeStep);
  }

  handleDeactivate() {
    clearInterval(this.interval);
  }

  handleFrame = () => {
    if (!this.activated) return;

    this.event.now = Date.now();
    this.event.dt = this.timeStep;

    this.emit("frame-loop", this.event);
  };
}
