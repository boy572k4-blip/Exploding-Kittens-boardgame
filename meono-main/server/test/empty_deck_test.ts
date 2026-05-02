// @ts-nocheck
import assert from "assert";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config";
import { GameRoomState } from "../src/rooms/schema/GameRoomState";
import { Card } from "../shared/card";
import { TurnState } from "../shared/util";

describe("Empty Deck Test - Game should end when deck is empty", () => {
    let colyseus: ColyseusTestServer;

    beforeEach(async () => {
        colyseus = await boot(appConfig);
    });

    afterEach(async () => {
        await colyseus.shutdown();
    });

    it("When deck has 1 card left and player draws it, game should end", async () => {
        const room = await colyseus.createRoom("game_room", {
            instanceId: "test-empty-deck"
        });

        const client1 = await colyseus.connectTo(room, { displayName: "Player1" });
        const client2 = await colyseus.connectTo(room, { displayName: "Player2" });

        await new Promise(resolve => setTimeout(resolve, 100));

        client1.send("start");
        await new Promise(resolve => setTimeout(resolve, 200));

        const state: GameRoomState = room.state;
        assert.strictEqual(state.started, true);
        assert.strictEqual(state.players.length, 2);

        console.log("\n=== SETUP: DECK WITH 1 CARD ===");
        // Clear deck and put only 1 non-bomb card
        state.deck.length = 0;
        state.deck.push(Card.TACOCAT);
        state.deckLength = state.deck.length;

        console.log("Deck length:", state.deck.length);
        console.log("Deck:", state.deck);
        console.log("Turn state:", state.turnState);
        console.log("Players alive:", state.players.length);

        // Player 1 draws the last card
        console.log("\n=== PLAYER 1 DRAWS LAST CARD ===");
        client1.send("drawCard");
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log("Deck length after draw:", state.deck.length);
        console.log("Turn state after draw:", state.turnState);
        console.log("Player 1 cards:", state.players.at(0).cards.toArray());
        console.log("Players alive:", state.players.length);

        // Deck should be empty
        assert.strictEqual(state.deck.length, 0, "Deck should be empty");
        
        // Game should be over
        assert.strictEqual(state.turnState, TurnState.GameOver, "Game should be over when deck is empty");
        
        // Both players should still be alive (they win)
        assert.strictEqual(state.players.length, 2, "Both players should still be alive");

        console.log("\n=== TEST PASSED - GAME ENDED WHEN DECK EMPTY ===");
    });

    it("When deck is empty and player tries to draw, game should end immediately", async () => {
        const room = await colyseus.createRoom("game_room", {
            instanceId: "test-empty-deck-2"
        });

        const client1 = await colyseus.connectTo(room, { displayName: "Player1" });
        const client2 = await colyseus.connectTo(room, { displayName: "Player2" });

        await new Promise(resolve => setTimeout(resolve, 100));

        client1.send("start");
        await new Promise(resolve => setTimeout(resolve, 200));

        const state: GameRoomState = room.state;

        console.log("\n=== SETUP: EMPTY DECK ===");
        // Clear deck completely
        state.deck.length = 0;
        state.deckLength = 0;

        console.log("Deck length:", state.deck.length);
        console.log("Turn state:", state.turnState);

        // Player 1 tries to draw from empty deck
        console.log("\n=== PLAYER 1 TRIES TO DRAW FROM EMPTY DECK ===");
        client1.send("drawCard");
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log("Turn state after draw attempt:", state.turnState);
        console.log("Players alive:", state.players.length);

        // Game should be over immediately
        assert.strictEqual(state.turnState, TurnState.GameOver, "Game should end immediately when trying to draw from empty deck");
        
        // Both players should still be alive
        assert.strictEqual(state.players.length, 2, "Both players should still be alive");

        console.log("\n=== TEST PASSED - GAME ENDED IMMEDIATELY ===");
    });

    it("When deck has 1 bomb left and player draws it with defuse, game continues", async () => {
        const room = await colyseus.createRoom("game_room", {
            instanceId: "test-last-bomb"
        });

        const client1 = await colyseus.connectTo(room, { displayName: "Player1" });
        const client2 = await colyseus.connectTo(room, { displayName: "Player2" });

        await new Promise(resolve => setTimeout(resolve, 100));

        client1.send("start");
        await new Promise(resolve => setTimeout(resolve, 200));

        const state: GameRoomState = room.state;

        console.log("\n=== SETUP: DECK WITH 1 BOMB ===");
        // Clear deck and put only 1 bomb
        state.deck.length = 0;
        state.deck.push(Card.EXPLODING);
        state.deckLength = state.deck.length;

        console.log("Deck length:", state.deck.length);
        console.log("Deck:", state.deck);
        console.log("Player 1 has defuse?", state.players.at(0).cards.toArray().includes(Card.DEFUSE));

        // Player 1 draws the bomb
        console.log("\n=== PLAYER 1 DRAWS BOMB ===");
        client1.send("drawCard");
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log("Turn state:", state.turnState);
        console.log("Deck length:", state.deck.length);
        console.log("Players alive:", state.players.length);

        // Player should be choosing position (has defuse)
        assert.strictEqual(state.turnState, TurnState.ChoosingExplodingPosition, "Player should be choosing position");
        assert.strictEqual(state.deck.length, 0, "Deck should be empty (bomb was drawn)");
        assert.strictEqual(state.players.length, 2, "Both players should be alive");

        // Player 1 puts bomb back at top
        console.log("\n=== PLAYER 1 PUTS BOMB BACK ===");
        client1.send("choosePosition", { index: 0 });
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log("Turn state:", state.turnState);
        console.log("Deck length:", state.deck.length);
        console.log("Deck:", state.deck);
        console.log("Turn index:", state.turnIndex);

        // Game should continue (bomb is back in deck)
        assert.strictEqual(state.turnState, TurnState.Normal, "Game should continue");
        assert.strictEqual(state.deck.length, 1, "Deck should have 1 card (the bomb)");
        assert.strictEqual(state.deck[0], Card.EXPLODING, "Deck should contain the bomb");
        assert.strictEqual(state.turnIndex, 1, "Turn should move to Player 2");

        console.log("\n=== TEST PASSED - GAME CONTINUES WITH BOMB IN DECK ===");
    });

    it("When deck has 1 bomb and player draws it WITHOUT defuse, player dies and game ends", async () => {
        const room = await colyseus.createRoom("game_room", {
            instanceId: "test-last-bomb-no-defuse"
        });

        const client1 = await colyseus.connectTo(room, { displayName: "Player1" });
        const client2 = await colyseus.connectTo(room, { displayName: "Player2" });

        await new Promise(resolve => setTimeout(resolve, 100));

        client1.send("start");
        await new Promise(resolve => setTimeout(resolve, 200));

        const state: GameRoomState = room.state;

        console.log("\n=== SETUP: REMOVE DEFUSE AND DECK WITH 1 BOMB ===");
        // Remove Player 1's defuse
        const defuseIndex = state.players.at(0).cards.indexOf(Card.DEFUSE);
        if (defuseIndex !== -1) {
            state.players.at(0).cards.deleteAt(defuseIndex);
        }
        console.log("Player 1 has defuse?", state.players.at(0).cards.toArray().includes(Card.DEFUSE));

        // Clear deck and put only 1 bomb
        state.deck.length = 0;
        state.deck.push(Card.EXPLODING);
        state.deckLength = state.deck.length;

        console.log("Deck length:", state.deck.length);
        console.log("Players alive before:", state.players.length);

        // Player 1 draws the bomb
        console.log("\n=== PLAYER 1 DRAWS BOMB WITHOUT DEFUSE ===");
        client1.send("drawCard");
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log("Turn state:", state.turnState);
        console.log("Deck length:", state.deck.length);
        console.log("Players alive after:", state.players.length);

        // Player 1 should be dead, only Player 2 remains
        assert.strictEqual(state.players.length, 1, "Only 1 player should remain");
        
        // Game should be over (only 1 player left)
        assert.strictEqual(state.turnState, TurnState.GameOver, "Game should be over");

        console.log("\n=== TEST PASSED - PLAYER DIED, GAME OVER ===");
    });
});
