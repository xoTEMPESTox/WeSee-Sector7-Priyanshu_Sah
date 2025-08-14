import { Memo, Middleware } from "polymatic";

import { type ClientBilliardContext } from "./ClientContext";

export class StatusOffline extends Middleware<ClientBilliardContext> {
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
    if (this.memo.update(context.shotInProgress, context.gameOver)) {
      const status = [];
      status.push("Offline Mode");
      if (context.shotInProgress) {
        status.push("Shot in progress");
      } else if (context.gameOver) {
        status.push("Game over");
      }
      this.statusElement.innerText = status.join(" | ");
    }
  };
}
