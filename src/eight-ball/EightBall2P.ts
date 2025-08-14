import { Middleware } from "polymatic";

import { Color, Ball, type BilliardContext } from "./BilliardContext";

/**
 * 2-player eight-ball rules and gameplay.
 */
export class EightBall2P extends Middleware<BilliardContext> {
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
    this.context.players[0].color = Color.stripe;
    this.context.players[1].color = Color.solid;
  }

  handleShotEnd = (data: { pocketed: Ball[] }) => {
    const player = this.context.players.find((player) => player.turn === this.context.turn.current);

    const hasCueBall = data.pocketed.some((ball) => Color.is(ball.color, Color.white));
    const hasEightBall = data.pocketed.some((ball) => Color.is(ball.color, Color.black));
    const hasOwnBall = data.pocketed.some((ball) => Color.is(ball.color, player?.color));

    if (hasEightBall) {
      const ownBallLeft = this.context.balls.some((ball) => Color.is(ball.color, player?.color));
      const playerWin = !ownBallLeft;
      const winner = playerWin ? player : this.context.players.find((p) => p.id !== player.id);
      this.context.gameOver = true;
      this.context.winner = winner?.id;
      this.emit("game-over");
    } else if (hasCueBall) {
      this.emit("pass-turn");
      setTimeout(() => this.emit("init-cue-ball"), 400);
    } else if (hasOwnBall) {
    } else {
      this.emit("pass-turn");
    }
    this.emit("update");
  };
}
