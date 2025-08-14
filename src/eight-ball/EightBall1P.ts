import { Middleware } from "polymatic";

import { Color, Ball, type BilliardContext } from "./BilliardContext";

/**
 * 1-player eight-ball rules and gameplay.
 */
export class EightBall1P extends Middleware<BilliardContext> {
  constructor() {
    super();
    this.on("activate", this.handleActivate);
    this.on("game-start", this.handleGameStart);
    this.on("shot-end", this.handleShotEnd);
  }

  handleActivate() {
    this.emit("init-table");
    this.emit("rack-balls");
  }

  handleGameStart() {
    this.emit("init-cue-ball");
  }

  handleShotEnd = (data: { pocketed: Ball[] }) => {
    const isCueBall = data.pocketed.some((ball) => ball.color === Color.white);
    const isEightBall = data.pocketed.some((ball) => ball.color === Color.black);

    if (isEightBall) {
      this.context.gameOver = true;
      this.emit("game-over");
    } else if (isCueBall) {
      setTimeout(() => this.emit("init-cue-ball"), 400);
    }
    this.emit("update");
  };
}
