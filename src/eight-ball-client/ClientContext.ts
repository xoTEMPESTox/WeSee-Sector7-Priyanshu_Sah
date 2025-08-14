import { BilliardContext, type Player } from "../eight-ball/BilliardContext";

export interface Auth {
  id: string;
  secret: string;
}

export class ClientBilliardContext extends BilliardContext {
  player?: Player;
  room?: string;
  auth?: Auth;
}

export const isMyTurn = (context: ClientBilliardContext) => {
  if (context.shotInProgress || context.gameOver || !context.gameStarted) return false;
  if (context.turn?.current !== context.player?.turn) return false;
  return true;
};
