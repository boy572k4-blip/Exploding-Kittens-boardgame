// @ts-nocheck
import assert from "assert";
import {boot, ColyseusTestServer} from "@colyseus/testing";
import appConfig from "../src/app.config";
import {GameRoomState} from "../src/rooms/schema/GameRoomState";
import {Card} from "../shared/card";
import {TurnState} from "../shared/util";

describe("defuse logic tests", () => {
    let colyseus: ColyseusTestServer;

    before(async () => colyseus = await boot(appConfig));
    after(async () => colyseus.shutdown());

    beforeEach(async () => await colyseus.cleanup());

    it("player 1 draws exploding with defuse, player 2 draws exploding with defuse", async () => {
        const {room, clients} = await setupRoom(colyseus, 3);
        clients[0].send("start");
        await room.waitForNextPatch();

        // Setup: 2 Exploding in deck
        room.state.deck = [Card.EXPLODING, Card.EXPLODING, Card.TACOCAT];
        room.state.deckLength = room.state.deck.length;
        await room.waitForNextPatch();

        console.log("=== P0 draws Exploding ===");
        console.log("Before: turnIndex =", room.state.turnIndex);
        console.log("Before: P0 cards =", room.state.players[0].toJSON().cards.length);
        console.log("Before: P0 has Defuse =", room.state.players[0].toJSON().cards.includes(Card.DEFUSE));

        // P0 draws Exploding (has Defuse)
        clients[0].send("drawCard");
        await room.waitForNextPatch();
        
        console.log("After draw: turnState =", room.state.turnState);
        console.log("After draw: P0 cards =", room.state.players[0].toJSON().cards.length);
        console.log("After draw: P0 has Defuse =", room.state.players[0].toJSON().cards.includes(Card.DEFUSE));
        
        assert.strictEqual(room.state.turnState, TurnState.ChoosingExplodingPosition);
        assert.strictEqual(room.state.players[0].toJSON().cards.length, 4); // 5 - 1 Defuse = 4
        assert.strictEqual(room.state.players[0].toJSON().cards.includes(Card.DEFUSE), false); // Defuse used
        
        clients[0].send("choosePosition", {index: 0});
        await room.waitForNextPatch();
        
        console.log("After choose: turnIndex =", room.state.turnIndex);
        console.log("After choose: turnState =", room.state.turnState);
        
        assert.strictEqual(room.state.turnState, TurnState.Normal);
        assert.strictEqual(room.state.turnIndex, 1); // P1's turn

        console.log("\n=== P1 draws Exploding ===");
        console.log("Before: turnIndex =", room.state.turnIndex);
        console.log("Before: P1 cards =", room.state.players[1].toJSON().cards.length);
        console.log("Before: P1 has Defuse =", room.state.players[1].toJSON().cards.includes(Card.DEFUSE));

        // P1 draws Exploding (has Defuse)
        clients[1].send("drawCard");
        await room.waitForNextPatch();
        
        console.log("After draw: turnState =", room.state.turnState);
        console.log("After draw: P1 cards =", room.state.players[1].toJSON().cards.length);
        console.log("After draw: P1 has Defuse =", room.state.players[1].toJSON().cards.includes(Card.DEFUSE));
        
        assert.strictEqual(room.state.turnState, TurnState.ChoosingExplodingPosition);
        assert.strictEqual(room.state.players[1].toJSON().cards.length, 4); // 5 - 1 Defuse = 4
        assert.strictEqual(room.state.players[1].toJSON().cards.includes(Card.DEFUSE), false); // Defuse used
        
        clients[1].send("choosePosition", {index: 0});
        await room.waitForNextPatch();
        
        console.log("After choose: turnIndex =", room.state.turnIndex);
        console.log("After choose: players alive =", room.state.players.length);
        
        assert.strictEqual(room.state.turnIndex, 2); // P2's turn
        assert.strictEqual(room.state.players.length, 3); // All alive
    });

    it("player 1 draws exploding without defuse (dies), player 2 draws with defuse", async () => {
        const {room, clients} = await setupRoom(colyseus, 3);
        clients[0].send("start");
        await room.waitForNextPatch();

        // Setup: Remove P1's Defuse, 2 Exploding in deck
        room.state.players[1].cards.deleteAt(room.state.players[1].cards.indexOf(Card.DEFUSE));
        room.state.deck = [Card.EXPLODING, Card.EXPLODING, Card.TACOCAT];
        room.state.deckLength = room.state.deck.length;
        await room.waitForNextPatch();

        console.log("=== P0 draws Exploding ===");
        // P0 draws Exploding (has Defuse)
        clients[0].send("drawCard");
        await room.waitForNextPatch();
        
        assert.strictEqual(room.state.turnState, TurnState.ChoosingExplodingPosition);
        
        clients[0].send("choosePosition", {index: 0});
        await room.waitForNextPatch();
        
        assert.strictEqual(room.state.turnIndex, 1); // P1's turn

        console.log("\n=== P1 draws Exploding (NO DEFUSE) ===");
        console.log("Before: turnIndex =", room.state.turnIndex);
        console.log("Before: P1 has Defuse =", room.state.players[1].toJSON().cards.includes(Card.DEFUSE));
        console.log("Before: players =", room.state.players.length);

        // P1 draws Exploding (NO Defuse - should die)
        clients[1].send("drawCard");
        await room.waitForNextPatch();
        
        console.log("After draw: turnState =", room.state.turnState);
        console.log("After draw: turnIndex =", room.state.turnIndex);
        console.log("After draw: players =", room.state.players.length);
        console.log("After draw: P1 (now index 1) name =", room.state.players[1]?.displayName);
        
        assert.strictEqual(room.state.turnState, TurnState.Normal);
        assert.strictEqual(room.state.players.length, 2); // P1 died
        assert.strictEqual(room.state.turnIndex, 1); // Now points to P2 (was index 2, now index 1)
        assert.strictEqual(room.state.players[1].displayName, "Test User 2"); // P2 is now at index 1

        console.log("\n=== P2 (now at index 1) draws card ===");
        console.log("Before: P2 has Defuse =", room.state.players[1].toJSON().cards.includes(Card.DEFUSE));
        
        // P2 draws normal card (should be fine)
        clients[2].send("drawCard");
        await room.waitForNextPatch();
        
        console.log("After draw: players =", room.state.players.length);
        console.log("After draw: turnState =", room.state.turnState);
        
        assert.strictEqual(room.state.players.length, 2); // Still 2 players
        assert.strictEqual(room.state.turnState, TurnState.Normal);
    });
});

async function setupRoom(colyseus: ColyseusTestServer, noClients = 3) {
    const room = await colyseus.createRoom<GameRoomState>("game_room", {
        "instanceId": "12345678"
    });

    const clientPromises = Array.from(new Array(noClients).keys()).map(async index => await colyseus.connectTo(room, {"displayName": "Test User " + index}));
    const clients = await Promise.all(clientPromises);

    clients[0].send("changeSettings", {isImplodingEnabled: true, nopeQTECooldown: 200});

    await room.waitForNextPatch();

    return {
        room: room,
        clients: clients
    };
}
