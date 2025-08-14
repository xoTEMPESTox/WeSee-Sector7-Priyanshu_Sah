import { Middleware } from "polymatic";

import { Color, Ball, type BilliardContext } from "./BilliardContext";

/**
 * Triangular rack
 */
export class Rack extends Middleware<BilliardContext> {
  constructor() {
    super();
    this.on("rack-balls", this.handleRackBalls);
  }

  handleRackBalls() {
    const r = this.context.table.ballRadius;
    const cx = this.context.table.width / 4;
    const cy = 0;

    const colors = [...Color.all].sort((a, b) => 0.5 - Math.random());
    colors.splice(4, 0, Color.black);

    const points = triangle(r);

    const balls = points.map(
      (p) =>
        new Ball(
          {
            x: cx + p.x + Math.random() * r * 0.02,
            y: cy + p.y + Math.random() * r * 0.02,
          },
          r,
          colors.shift(),
        ),
    );

    this.context.balls = balls;

    this.emit("update");
  }
}

const triangle = (r: number) => {
  const SPI3 = Math.sin(Math.PI / 3);
  const n = 5;
  const d = r * 2;
  const l = SPI3 * d;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      points.push({
        x: i * l /*- (n - 1) * 0.5 * l*/ + Math.random() * r * 0.02,
        y: (j - i * 0.5) * d + Math.random() * r * 0.02,
      });
    }
  }
  return points;
};
