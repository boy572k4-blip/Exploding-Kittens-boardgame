// @ts-nocheck
import assert from "assert";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config";
import { GameRoomState } from "../src/rooms/schema/GameRoomState";
import { Card } from "../shared/card";
import { TurnState } from "../shared/util";

describe("Defuse Bomb Sequence Test", () => {
    let colyseus: ColyseusTestServer;

    beforeEach(async () => {
        colyseus = await boot(appConfig);
    });

    afterEach(async () => {
        await colyseus.shutdown();
    });

    it("Player 1 draws bomb with defuse, Player 2 draws bomb with defuse - both should survive", async () => {
        // Create room
        const room = await colyseus.createRoom("game_room", {
            instanceId: "test-instance-sequence"
        });

        // Connect 3 clients
        const client1 = await colyseus.connectTo(room, { displayName: "Player1" });
        const client2 = await colyseus.connectTo(room, { displayName: "Player2" });
        const client3 = await colyseus.connectTo(room, { displayName: "Player3" });

        // Wait for state sync
        await new Promise(resolve => setTimeout(resolve, 100));

        // Start game
        client1.send("start");
        await new Promise(resolve => setTimeout(resolve, 200));

        const state: GameRoomState = room.state;
        assert.strictEqual(state.started, true, "Game should be started");
        assert.strictEqual(state.players.length, 3, "Should have 3 players");

        console.log("\n=== INITIAL STATE ===");
        console.log("Players:", state.players.length);
        console.log("Deck length:", state.deck.length);
        console.log("Player 1 cards:", state.players.at(0).cards.toArray());
        console.log("Player 2 cards:", state.players.at(1).cards.toArray());

        // Give Player 1 a Defuse (in addition to starting defuse)
        state.players.at(0).cards.push(Card.DEFUSE);
        console.log("\n=== GAVE PLAYER 1 EXTRA DEFUSE ===");
        console.log("Player 1 cards:", state.players.at(0).cards.toArray());
        console.log("Player 1 has defuse?", state.players.at(0).cards.toArray().includes(Card.DEFUSE));

        // Give Player 2 a Defuse (in addition to starting defuse)
        state.players.at(1).cards.push(Card.DEFUSE);
        console.log("Player 2 cards:", state.players.at(1).cards.toArray());
        console.log("Player 2 has defuse?", state.players.at(1).cards.toArray().includes(Card.DEFUSE));

        // Put Exploding at top of deck
        state.deck.unshift(Card.EXPLODING);
        const deckLengthBefore = state.deck.length;
        console.log("\n=== SETUP: PUT BOMB AT TOP ===");
        console.log("Deck length:", deckLengthBefore);
        console.log("Deck top 5 cards:", state.deck.slice(0, 5));

        // Player 1 draws Exploding
        console.log("\n=== PLAYER 1 DRAWS BOMB ===");
        console.log("Turn index before:", state.turnIndex);
        console.log("Turn state before:", state.turnState);
        
        client1.send("drawCard");
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log("Turn state after draw:", state.turnState);
        console.log("Player 1 cards after draw:", state.players.at(0).cards.toArray());
        console.log("Player 1 has defuse?", state.players.at(0).cards.toArray().includes(Card.DEFUSE));
        console.log("Player 1 has bomb?", state.players.at(0).cards.toArray().includes(Card.EXPLODING));
        console.log("Discard pile:", state.discard.toArray());
        console.log("Deck length:", state.deck.length);

        // Player 1 should be in ChoosingExplodingPosition state
        assert.strictEqual(state.turnState, TurnState.ChoosingExplodingPosition, "Player 1 should be choosing position");
        assert.strictEqual(state.players.at(0).cards.toArray().includes(Card.EXPLODING), false, "Player 1 should not have bomb in hand");
        assert.strictEqual(state.discard.toArray().includes(Card.DEFUSE), true, "Defuse should be in discard");

        // Player 1 chooses to put bomb at bottom of deck
        console.log("\n=== PLAYER 1 PUTS BOMB AT BOTTOM ===");
        const putAtIndex = state.deck.length; // Bottom
        console.log("Putting bomb at index:", putAtIndex);
        
        client1.send("choosePosition", { index: putAtIndex });
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log("Turn state after choosing:", state.turnState);
        console.log("Turn index after choosing:", state.turnIndex);
        console.log("Deck length:", state.deck.length);
        console.log("Deck bottom 5 cards:", state.deck.slice(-5));
        console.log("Bomb at bottom?", state.deck[state.deck.length - 1] === Card.EXPLODING);

        assert.strictEqual(state.turnState, TurnState.Normal, "Should be back to normal state");
        assert.strictEqual(state.deck[state.deck.length - 1], Card.EXPLODING, "Bomb should be at bottom");
        assert.strictEqual(state.turnIndex, 1, "Turn should move to Player 2");

        // Put another Exploding at top of deck for Player 2
        console.log("\n=== SETUP: PUT ANOTHER BOMB AT TOP FOR PLAYER 2 ===");
        state.deck.unshift(Card.EXPLODING);
        const deckLengthBeforePlayer2 = state.deck.length;
        console.log("Deck length:", deckLengthBeforePlayer2);
        console.log("Deck top 5 cards:", state.deck.slice(0, 5));
        console.log("Player 2 cards before draw:", state.players.at(1).cards.toArray());
        console.log("Player 2 has defuse?", state.players.at(1).cards.toArray().includes(Card.DEFUSE));

        // Player 2 draws Exploding
        console.log("\n=== PLAYER 2 DRAWS BOMB ===");
        console.log("Turn index before:", state.turnIndex);
        console.log("Turn state before:", state.turnState);
        console.log("Players alive before:", state.players.length);
        
        client2.send("drawCard");
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log("\n=== AFTER PLAYER 2 DRAWS ===");
        console.log("Turn state:", state.turnState);
        console.log("Players alive:", state.players.length);
        console.log("Player 2 still exists?", state.players.length >= 2);
        
        if (state.players.length >= 2) {
            console.log("Player 2 cards:", state.players.at(1).cards.toArray());
            console.log("Player 2 has defuse?", state.players.at(1).cards.toArray().includes(Card.DEFUSE));
            console.log("Player 2 has bomb?", state.players.at(1).cards.toArray().includes(Card.EXPLODING));
        } else {
            console.log("❌ PLAYER 2 DIED! This is the bug!");
        }
        
        console.log("Discard pile:", state.discard.toArray());
        console.log("Deck length:", state.deck.length);

        // Player 2 should be in ChoosingExplodingPosition state
        assert.strictEqual(state.players.length, 3, "All 3 players should still be alive");
        assert.strictEqual(state.turnState, TurnState.ChoosingExplodingPosition, "Player 2 should be choosing position");
        
        if (state.players.length >= 2) {
            assert.strictEqual(state.players.at(1).cards.toArray().includes(Card.EXPLODING), false, "Player 2 should not have bomb in hand");
        }

        // Player 2 chooses to put bomb at top of deck
        console.log("\n=== PLAYER 2 PUTS BOMB AT TOP ===");
        client2.send("choosePosition", { index: 0 });
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log("Turn state after choosing:", state.turnState);
        console.log("Players alive:", state.players.length);
        console.log("Deck length:", state.deck.length);

        // Both players should still be alive
        assert.strictEqual(state.players.length, 3, "All 3 players should still be alive at end");
        assert.strictEqual(state.turnState, TurnState.Normal, "Should be back to normal state");
        
        console.log("\n=== TEST PASSED ===");
    });
});
