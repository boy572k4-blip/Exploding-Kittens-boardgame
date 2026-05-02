import {ArraySchema, filter, MapSchema, Schema, type} from "@colyseus/schema";
import {Client} from "@colyseus/core";
import {Card} from "../../../shared/card";
import {TurnState} from "../../../shared/util";

export class LobbyPlayer extends Schema {

  @type("string") displayName: string;
  @type("string") sessionId: string;

}

export class GamePlayer extends Schema {

    @type("string") sessionId: string;
    @type("string") displayName: string;

    @filter(function (
        this: GamePlayer,
        client: Client,
    ) {
        return this.sessionId === client.sessionId;
    })
    @type(["number"]) cards = new ArraySchema<Card>();
    @type("number") numCards = 0;
    
    // FIXED: Add flag to track disconnected players waiting for rejoin
    disconnectedAt?: number; // Timestamp when player disconnected
    removeTimeout?: ReturnType<typeof setTimeout>; // Timeout to remove player

    constructor() {
        super();

        this.cards.push = (...values) => {
            this.numCards += values.length;
            return ArraySchema.prototype.push.apply(this.cards, values);
        }

        this.cards.deleteAt = (index) => {
            let success = ArraySchema.prototype.deleteAt.apply(this.cards, [index]);
            if (success) this.numCards--;
            return success;
        }
    }
}

export class GameRoomState extends Schema {

    // Functional properties
    @type("string") ownerId: string = "";
    @type("boolean") started: boolean = false;
    @type([GamePlayer]) players = new ArraySchema<GamePlayer>();
    @type([LobbyPlayer]) spectators = new ArraySchema<LobbyPlayer>();
    @type({ map: "number" }) playerIndexMap = new MapSchema<number>();

    // Game Settings
    @type("boolean") isImplodingEnabled = true;
    @type("number") nopeQTECooldown = 3000;

    // Generic game state
    @type("number") turnIndex: number = 0;
    @type("number") turnCount: number = 0;
    @type("number") turnRepeats: number = 1;
    @type("number") turnOrder: number = 1;
    @type("number") turnState: TurnState = TurnState.Normal;
    @type(["number"]) discard = new ArraySchema<Card>();
    @type("number") deckLength: number = 0;

    // Imploding kitten state
    @type("boolean") implosionRevealed: boolean = false;
    @type("boolean") implosionVisible: boolean = false;
    @filter(function (
        this: GameRoomState,
        _: Client,
        value: number,
    ) {
        return this.implosionRevealed && value < 10;
    })
    @type("number") distanceToImplosion: number;
    setDistanceToImplosion(value: number) {
        // FIXED: Handle negative value (card not found) and prevent division by zero
        if (value < 0) {
            value = this.deck.length;
        }
        
        this.distanceToImplosion = value;
        this.implosionVisible = this.implosionRevealed && value < 10;
        
        // FIXED: Prevent division by zero
        if (this.deck.length > 0) {
            this.distanceToImplosionEstimator = ["Top", "Middle", "Bottom"][Math.floor(3 * this.distanceToImplosion / this.deck.length)];
        } else {
            this.distanceToImplosionEstimator = "Unknown";
        }
    }

    @filter(function (
        this: GameRoomState,
    ) {
        return this.implosionRevealed;
    })
    @type("string") distanceToImplosionEstimator: string;

    // Private properties
    nopeTimeout: ReturnType<typeof setTimeout>;
    favourTimeout?: ReturnType<typeof setTimeout>; // FIXED: Add favourTimeout
    deck = new Array<Card>();
    noped = false;
    attacked = false;
}
