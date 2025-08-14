import { Memo, Middleware } from "polymatic";

import { type ClientBilliardContext } from "./ClientContext";

export class StatusOnline extends Middleware<ClientBilliardContext> {
  statusElement: HTMLElement;
  memo = Memo.init();

  constructor() {
    super();
    this.on("activate", this.handleActivate);
    this.on("deactivate", this.handleDeactivate);
    this.on("frame-loop", this.handleFrameLoop);
  }

  handleActivate() {
    this.statusElement = document.getElementById("game-status");
  }

  handleDeactivate() {
    this.memo.clear();
    this.statusElement.innerText = null;
  }

  handleFrameLoop = () => {
    const context = this.context;
    const player = context.player;
    if (
      this.memo.update(
        player?.color,
        player?.turn,
        context.turn?.current,
        context.players?.length,
        context.shotInProgress,
        context.room,
      )
    ) {
      const status = [];
      status.push(context.room);
      if (context.gameOver) {
        if (context.winner) {
          if (context.winner === context.player.id) {
            status.push("You win");
          } else {
            status.push("You lose");
          }
        } else {
          status.push("Game over");
        }
      } else {
        if (player?.color) {
          status.push("Play " + player?.color);
        }
        if (!context.players || context.players.length < 2) {
          status.push("Waiting for opponent");
        } else if (context.shotInProgress) {
          status.push("Shot in progress");
        } else if (context.turn?.current && player?.turn) {
          status.push(context.turn?.current === player?.turn ? "Your turn" : "Opponent's turn");
        }
      }
      this.statusElement.innerText = status.join(" | ");
    }
  };
}
