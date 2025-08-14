import { Runtime } from "polymatic";

import { LobbyClient } from "./lobby-client/LobbyClient";

Runtime.activate(new LobbyClient(), {});
