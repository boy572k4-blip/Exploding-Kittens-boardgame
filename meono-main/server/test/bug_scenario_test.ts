// @ts-nocheck
import assert from "assert";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config";
import { GameRoomState } from "../src/rooms/schema/GameRoomState";
import { Card } from "../shared/card";
import { TurnState } from "../shared/util";

describe("Bug Scenario: Player 1 draws bomb, Player 2 draws bomb immediately after", () => {
    let colyseus: ColyseusTestServer;

    beforeEach(async () => {
        colyseus = await boot(appConfig);
    });

    afterEach(async () => {
        await colyseus.shutdown();
    });

    it("Player 1 draws bomb with defuse, puts it back at position 1, Player 2 immediately draws that bomb", async () => {
        // Create room
        const room = await colyseus.createRoom("game_room", {
            instanceId: "test-bug-scenario"
        });

        // Connect 2 clients
        const client1 = await colyseus.connectTo(room, { displayName: "Player1" });
        const client2 = await colyseus.connectTo(room, { displayName: "Player2" });

        // Wait for state sync
        await new Promise(resolve => setTimeout(resolve, 100));

        // Start game
        client1.send("start");
        await new Promise(resolve => setTimeout(resolve, 200));

        const state: GameRoomState = room.state;
        assert.strictEqual(state.started, true, "Game should be started");
        assert.strictEqual(state.players.length, 2, "Should have 2 players");

        console.log("\n=== INITIAL STATE ===");
        console.log("Players:", state.players.length);
        console.log("Player 1 cards:", state.players.at(0).cards.toArray());
        console.log("Player 1 has defuse?", state.players.at(0).cards.toArray().includes(Card.DEFUSE));
        console.log("Player 2 cards:", state.players.at(1).cards.toArray());
        console.log("Player 2 has defuse?", state.players.at(1).cards.toArray().includes(Card.DEFUSE));

        // Clear deck and put specific cards
        state.deck.length = 0;
        state.deck.push(
            Card.TACOCAT,      // Position 2 (bottom)
            Card.EXPLODING,    // Position 1 (middle)
            Card.EXPLODING     // Position 0 (top - Player 1 will draw this)
        );
        
        // Reverse to make EXPLODING at index 0 (top)
        state.deck.reverse();
        state.deckLength = state.deck.length;

        console.log("\n=== SETUP DECK ===");
        console.log("Deck:", state.deck);
        console.log("Deck length:", state.deck.length);
        console.log("Top card (index 0):", state.deck[0], "=", state.deck[0] === Card.EXPLODING ? "EXPLODING" : "OTHER");

        // Player 1 draws Exploding from top
        console.log("\n=== PLAYER 1 DRAWS BOMB ===");
        console.log("Turn index:", state.turnIndex);
        
        client1.send("drawCard");
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log("Turn state after draw:", state.turnState);
        console.log("Player 1 cards:", state.players.at(0).cards.toArray());
        console.log("Discard pile:", state.discard.toArray());
        console.log("Deck after draw:", state.deck);

        assert.strictEqual(state.turnState, TurnState.ChoosingExplodingPosition, "Player 1 should be choosing position");
        assert.strictEqual(state.players.at(0).cards.toArray().includes(Card.EXPLODING), false, "Player 1 should not have bomb in hand");

        // Player 1 puts bomb at position 1 (second from top)
        console.log("\n=== PLAYER 1 PUTS BOMB AT POSITION 1 ===");
        client1.send("choosePosition", { index: 1 });
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log("Deck after putting bomb back:", state.deck);
        console.log("Deck length:", state.deck.length);
        console.log("Turn index:", state.turnIndex);
        console.log("Turn state:", state.turnState);

        assert.strictEqual(state.turnState, TurnState.Normal, "Should be back to normal");
        assert.strictEqual(state.turnIndex, 1, "Should be Player 2's turn");
        assert.strictEqual(state.deck[1], Card.EXPLODING, "Bomb should be at position 1");

        // Player 2 draws from top (should draw the OTHER bomb that was already there)
        console.log("\n=== PLAYER 2 DRAWS CARD ===");
        console.log("Player 2 cards before:", state.players.at(1).cards.toArray());
        console.log("Player 2 has defuse?", state.players.at(1).cards.toArray().includes(Card.DEFUSE));
        console.log("Deck before Player 2 draws:", state.deck);
        console.log("Top card:", state.deck[0]);
        
        client2.send("drawCard");
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log("\n=== AFTER PLAYER 2 DRAWS ===");
        console.log("Turn state:", state.turnState);
        console.log("Players alive:", state.players.length);
        
        if (state.players.length >= 2) {
            console.log("Player 2 cards:", state.players.at(1).cards.toArray());
            console.log("Player 2 has defuse?", state.players.at(1).cards.toArray().includes(Card.DEFUSE));
        } else {
            console.log("❌ PLAYER 2 DIED!");
        }
        
        console.log("Deck:", state.deck);
        console.log("Discard:", state.discard.toArray());

        // Player 2 should have drawn the EXPLODING that was at position 0
        // and should be choosing position (because they have defuse)
        assert.strictEqual(state.players.length, 2, "Both players should still be alive");
        assert.strictEqual(state.turnState, TurnState.ChoosingExplodingPosition, "Player 2 should be choosing position");

        console.log("\n=== TEST PASSED ===");
    });

    it("Player 1 draws bomb WITHOUT defuse - should die immediately", async () => {
        // Create room
        const room = await colyseus.createRoom("game_room", {
            instanceId: "test-no-defuse"
        });

        // Connect 2 clients
        const client1 = await colyseus.connectTo(room, { displayName: "Player1" });
        const client2 = await colyseus.connectTo(room, { displayName: "Player2" });

        await new Promise(resolve => setTimeout(resolve, 100));

        // Start game
        client1.send("start");
        await new Promise(resolve => setTimeout(resolve, 200));

        const state: GameRoomState = room.state;

        console.log("\n=== REMOVE PLAYER 1 DEFUSE ===");
        // Remove Player 1's defuse
        const defuseIndex = state.players.at(0).cards.indexOf(Card.DEFUSE);
        if (defuseIndex !== -1) {
            state.players.at(0).cards.deleteAt(defuseIndex);
        }
        console.log("Player 1 cards:", state.players.at(0).cards.toArray());
        console.log("Player 1 has defuse?", state.players.at(0).cards.toArray().includes(Card.DEFUSE));

        // Put bomb at top
        state.deck.unshift(Card.EXPLODING);
        console.log("Deck top:", state.deck[0]);

        // Player 1 draws bomb
        console.log("\n=== PLAYER 1 DRAWS BOMB WITHOUT DEFUSE ===");
        console.log("Players before:", state.players.length);
        
        client1.send("drawCard");
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log("Players after:", state.players.length);
        console.log("Turn state:", state.turnState);

        // Player 1 should be dead
        assert.strictEqual(state.players.length, 1, "Player 1 should be dead");
        assert.strictEqual(state.turnState, TurnState.Normal, "Should be normal state");

        console.log("\n=== TEST PASSED - PLAYER DIED AS EXPECTED ===");
    });
});
