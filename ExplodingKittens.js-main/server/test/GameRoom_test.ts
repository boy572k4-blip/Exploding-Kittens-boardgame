import assert = require("assert");
import {boot, ColyseusTestServer} from "@colyseus/testing";

// import your "app.config.ts" file here.
import appConfig from "../src/app.config";
import {GameRoomState} from "../src/rooms/schema/GameRoomState";
import {Card} from "../shared/card";
import {TurnState} from "../shared/util";
import {Room} from "@colyseus/core";

describe("lobby actions", () => {
    let colyseus: ColyseusTestServer;

    before(async () => colyseus = await boot(appConfig));
    after(async () => colyseus.shutdown());

    beforeEach(async () => await colyseus.cleanup());

    it("connecting into a room", async () => {
        // `room` is the server-side Room instance reference.
        const room = await colyseus.createRoom<GameRoomState>("game_room", {
            "instanceId": "12345678"
        });

        // `client1` is the client-side `Room` instance reference (same as JavaScript SDK)
        const client1 = await colyseus.connectTo(room, {"displayName": "Test User"});

        // make your assertions
        assert.strictEqual(client1.sessionId, room.clients[0].sessionId);

        // wait for state sync
        await room.waitForNextPatch();

        assert.strictEqual(client1.sessionId, client1.state.ownerId);
    });

    it("changing settings", async () => {
        const {room, clients} = await setupRoom(colyseus);

        clients[0].send("changeSettings", {isImplodingEnabled: false, nopeQTECooldown: 3000})

        await room.waitForNextPatch();

        assert.strictEqual(clients[0].state.isImplodingEnabled, false);
        assert.strictEqual(clients[1].state.isImplodingEnabled, false);
    });

    it("starting game without imploding kittens", async () => {
        const {room, clients} = await setupRoom(colyseus);
        clients[0].send("changeSettings", {isImplodingEnabled: false, nopeQTECooldown: 3000})
        clients[0].send("start");

        await room.waitForNextPatch();

        const playerCards = room.state.players.reduce<Array<Card>>((previous, current) => previous.concat(current.toJSON().cards), []);
        const allCards = room.state.deck.concat(playerCards);

        testBaseGameCards(allCards);

        assert.equal(allCards.filter(card => card === Card.DEFUSE).length, 6)
        assert.equal(allCards.filter(card => card === Card.EXPLODING).length, 2)

        assert.equal(allCards.length, 54)

        assert.ok(room.state.players.every(player => player.cards.length === 5))
    });

    it("starting game with imploding kittens", async () => {
        const {room, clients} = await setupRoom(colyseus);
        clients[0].send("start");

        await room.waitForNextPatch();

        const playerCards = room.state.players.reduce<Array<Card>>((previous, current) => previous.concat(current.toJSON().cards), []);
        const allCards = room.state.deck.concat(playerCards);

        testBaseGameCards(allCards);

        assert.equal(allCards.filter(card => card === Card.FERALCAT).length, 4)
        assert.equal(allCards.filter(card => card === Card.TARGETEDATTACK).length, 3)
        assert.equal(allCards.filter(card => card === Card.REVERSE).length, 4)
        assert.equal(allCards.filter(card => card === Card.DRAWFROMBOTTOM).length, 4)
        assert.equal(allCards.filter(card => card === Card.ALTERTHEFUTURE).length, 4)
        assert.equal(allCards.filter(card => card === Card.IMPLODING).length, 1)

        assert.equal(allCards.filter(card => card === Card.DEFUSE).length, 6)
        assert.equal(allCards.filter(card => card === Card.EXPLODING).length, 1)

        assert.equal(allCards.length, 73)

        assert.ok(room.state.players.every(player => player.cards.length === 5))
    })

    it("starting game with oversize room", async () => {
        const {room, clients} = await setupRoom(colyseus, 7);
        clients[0].send("start");

        await room.waitForNextPatch();

        const playerCards = room.state.players.reduce<Array<Card>>((previous, current) => previous.concat(current.toJSON().cards), []);
        const allCards = room.state.deck.concat(playerCards);

        assert.equal(allCards.length, (73 - 2) * 2 + (6)) // Killing cards aren't doubled
    });
});


describe("game actions", () => {
    let colyseus: ColyseusTestServer;

    before(async () => colyseus = await boot(appConfig));
    after(async () => colyseus.shutdown());

    beforeEach(async () => await colyseus.cleanup());

    it("draw card", async () => {
        let {room, clients} = await setupRoom(colyseus);
        clients[0].send("start");
        await room.waitForNextPatch();

        room.state.players[0].cards.clear();
        await room.waitForNextPatch();

        let card = room.state.deck[0];

        clients[0].send("drawCard");
        await room.waitForNextPatch();

        assert.strictEqual(room.state.turnState, TurnState.Normal);
        assert.strictEqual(room.state.turnIndex, 1);
        assert.strictEqual(room.state.players[0].toJSON().cards.length, 1);
        assert.ok(room.state.players[0].toJSON().cards.includes(card));
    });

    describe("play cards", () => {
        it("lying skip", async () => {
            let {room, clients} = await setupRoom(colyseus);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.clear();
            await room.waitForNextPatch();

            clients[0].send("playCard", {card: Card.SKIP});
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 0);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 0);
        });

        it("play skip", async () => {
            let {room, clients} = await setupRoom(colyseus);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.push(Card.SKIP);
            await room.waitForNextPatch();

            clients[0].send("playCard", {card: Card.SKIP});
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 1);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 5);
        });

        it("play reverse", async () => {
            let {room, clients} = await setupRoom(colyseus);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.push(Card.REVERSE);
            await room.waitForNextPatch();

            clients[0].send("playCard", {card: Card.REVERSE});
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 2);
            assert.strictEqual(room.state.turnOrder, -1);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 5);
        });

        it("play favour", async () => {
            let {room, clients} = await setupRoom(colyseus);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.push(Card.FAVOUR);
            room.state.players[1].cards.push(Card.EXPLODING);
            await room.waitForNextPatch();

            clients[0].send("playCard", {card: Card.FAVOUR, target: 1});
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Favouring);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 5);

            clients[1].send("favourResponse", {card: Card.IMPLODING}); // Shouldn't have this card
            await room.waitForNextPatch();

            assert.strictEqual(room.state.turnState, TurnState.Favouring);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 5);

            clients[1].send("favourResponse", {card: Card.EXPLODING}); // Definitely has this card
            await room.waitForNextPatch();

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 0);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 6);
        });

        it("play shuffle", async () => {
            let {room, clients} = await setupRoom(colyseus);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.push(Card.SHUFFLE);
            await room.waitForNextPatch();

            const deckBefore = structuredClone(room.state.deck);

            clients[0].send("playCard", {card: Card.SHUFFLE});
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 0);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 5);
            assert.notDeepEqual(room.state.deck, deckBefore); // Minuscule chance the deck stays the same
        });

        it("play see the future", async () => {
            let {room, clients} = await setupRoom(colyseus);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.push(Card.SEETHEFUTURE);
            await room.waitForNextPatch();

            clients[0].send("playCard", {card: Card.SEETHEFUTURE});
            await room.waitForNextPatch();

            const message = await clients[0].waitForMessage("theFuture");
            assert.deepEqual(message.cards, room.state.deck.slice(0, 3));

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 0);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 5);
        });

        it("play alter the future", async () => {
            let {room, clients} = await setupRoom(colyseus);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.push(Card.ALTERTHEFUTURE);
            await room.waitForNextPatch();

            clients[0].send("playCard", {card: Card.ALTERTHEFUTURE});
            await room.waitForNextPatch();

            const message = await clients[0].waitForMessage("theFuture");
            let cards = message.cards;
            assert.deepEqual(cards, room.state.deck.slice(0, 3));

            assert.strictEqual(room.state.turnState, TurnState.AlteringTheFuture);

            clients[0].send("alterTheFuture", {cards: [Card.EXPLODING, Card.EXPLODING, Card.EXPLODING]}); // Should fail
            await room.waitForNextPatch();

            assert.strictEqual(room.state.turnState, TurnState.AlteringTheFuture);

            // message.cards.reverse()
            clients[0].send("alterTheFuture", {cards: cards}); // Should succeed
            await room.waitForNextPatch();

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 0);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 5);
        });

        it("play attack", async () => {
            let {room, clients} = await setupRoom(colyseus);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.push(Card.ATTACK);
            room.state.players[1].cards.push(Card.ATTACK);
            room.state.players[2].cards.push(Card.SKIP);
            room.state.players[2].cards.push(Card.ATTACK);

            assert.strictEqual(room.state.attacked, false);

            await room.waitForNextPatch();

            clients[0].send("playCard", {card: Card.ATTACK});
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 1);
            assert.strictEqual(room.state.turnRepeats, 2);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 5);
            assert.strictEqual(room.state.attacked, true);

            clients[1].send("playCard", {card: Card.ATTACK});
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 2);
            assert.strictEqual(room.state.turnRepeats, 4);
            assert.strictEqual(room.state.players[1].toJSON().cards.length, 5);
            assert.strictEqual(room.state.attacked, true);

            clients[2].send("playCard", {card: Card.SKIP});
            await waitForNopeCooldown(room);
            clients[2].send("playCard", {card: Card.ATTACK});
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 0);
            assert.strictEqual(room.state.turnRepeats, 5);
            assert.strictEqual(room.state.players[2].toJSON().cards.length, 5);
            assert.strictEqual(room.state.attacked, true);
        });

        it("play targeted attack", async () => {
            let {room, clients} = await setupRoom(colyseus);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.push(Card.TARGETEDATTACK);
            room.state.players[2].cards.push(Card.SKIP);
            room.state.players[2].cards.push(Card.ATTACK);
            room.state.players[0].cards.push(Card.TARGETEDATTACK);

            assert.strictEqual(room.state.attacked, false);

            await room.waitForNextPatch();

            clients[0].send("playCard", {card: Card.TARGETEDATTACK, target: 2});
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 2);
            assert.strictEqual(room.state.turnRepeats, 2);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 6);
            assert.strictEqual(room.state.attacked, true);

            clients[2].send("playCard", {card: Card.SKIP});
            await waitForNopeCooldown(room);
            clients[2].send("playCard", {card: Card.ATTACK});
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 0);
            assert.strictEqual(room.state.turnRepeats, 3);
            assert.strictEqual(room.state.players[2].toJSON().cards.length, 5);
            assert.strictEqual(room.state.attacked, true);

            clients[0].send("playCard", {card: Card.TARGETEDATTACK, target: 2});
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 2);
            assert.strictEqual(room.state.turnRepeats, 5);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 5);
            assert.strictEqual(room.state.attacked, true);
        });

        it("play draw from bottom", async () => {
            let {room, clients} = await setupRoom(colyseus);
            clients[0].send("start");
            await room.waitForNextPatch();

            room.state.players[0].cards.clear();
            room.state.players[0].cards.push(Card.DRAWFROMBOTTOM);
            await room.waitForNextPatch();

            let card = room.state.deck[room.state.deck.length - 1];

            clients[0].send("playCard", {card: Card.DRAWFROMBOTTOM});
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 1);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 1);
            assert.ok(room.state.players[0].toJSON().cards.includes(card));
        });
    })

    describe("play combos", () => {
        it("lying 2-combo", async () => {
            let {room, clients} = await setupRoom(colyseus, 2);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.clear()
            await room.waitForNextPatch();

            clients[0].send("playCombo", {cards: [Card.TACOCAT, Card.TACOCAT], target: 1});
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 0);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 0);
            assert.strictEqual(room.state.players[1].toJSON().cards.length, 5);
        });

        it("failed 2-combo", async () => {
            let {room, clients} = await setupRoom(colyseus, 2);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.clear()
            room.state.players[0].cards.push(Card.EXPLODING, Card.FERALCAT);
            await room.waitForNextPatch();

            clients[0].send("playCombo", {cards: [Card.EXPLODING, Card.FERALCAT], target: 1});
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 0);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 0);
            assert.strictEqual(room.state.players[1].toJSON().cards.length, 5);
        });

        it("2-combo", async () => {
            let {room, clients} = await setupRoom(colyseus, 2);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.clear()
            room.state.players[0].cards.push(Card.TACOCAT, Card.TACOCAT);
            room.state.players[1].cards.clear()
            room.state.players[1].cards.push(Card.IMPLODING);
            await room.waitForNextPatch();

            clients[0].send("playCombo", {cards: [Card.TACOCAT, Card.TACOCAT], target: 1});
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 0);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 1);
            assert.strictEqual(room.state.players[1].toJSON().cards.length, 0);
        });

        it("2-combo with one feral", async () => {
            let {room, clients} = await setupRoom(colyseus, 2);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.clear()
            room.state.players[0].cards.push(Card.TACOCAT, Card.FERALCAT);
            room.state.players[1].cards.clear()
            room.state.players[1].cards.push(Card.IMPLODING);
            await room.waitForNextPatch();

            clients[0].send("playCombo", {cards: [Card.TACOCAT, Card.FERALCAT], target: 1});
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 0);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 1);
            assert.strictEqual(room.state.players[1].toJSON().cards.length, 0);
        });

        it("failed 3-combo", async () => {
            let {room, clients} = await setupRoom(colyseus, 2);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.clear()
            room.state.players[0].cards.push(Card.TACOCAT, Card.TACOCAT, Card.TACOCAT);
            room.state.players[1].cards.clear()
            room.state.players[1].cards.push(Card.IMPLODING);
            await room.waitForNextPatch();

            clients[0].send("playCombo", {
                cards: [Card.TACOCAT, Card.TACOCAT, Card.TACOCAT],
                target: 1,
                targetCard: Card.CATTERMELON
            });
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 0);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 0);
            assert.strictEqual(room.state.players[1].toJSON().cards.length, 1);
        });

        it("3-combo", async () => {
            let {room, clients} = await setupRoom(colyseus, 2);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.clear()
            room.state.players[0].cards.push(Card.TACOCAT, Card.TACOCAT, Card.TACOCAT);
            room.state.players[1].cards.clear()
            room.state.players[1].cards.push(Card.IMPLODING);
            await room.waitForNextPatch();

            clients[0].send("playCombo", {
                cards: [Card.TACOCAT, Card.TACOCAT, Card.TACOCAT],
                target: 1,
                targetCard: Card.IMPLODING
            });
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 0);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 1);
            assert.strictEqual(room.state.players[1].toJSON().cards.length, 0);
        });

        it("3-combo with one feral", async () => {
            let {room, clients} = await setupRoom(colyseus, 2);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.clear()
            room.state.players[0].cards.push(Card.TACOCAT, Card.TACOCAT, Card.FERALCAT);
            room.state.players[1].cards.clear()
            room.state.players[1].cards.push(Card.IMPLODING);
            await room.waitForNextPatch();

            clients[0].send("playCombo", {
                cards: [Card.TACOCAT, Card.TACOCAT, Card.FERALCAT],
                target: 1,
                targetCard: Card.IMPLODING
            });
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 0);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 1);
            assert.strictEqual(room.state.players[1].toJSON().cards.length, 0);
        });

        it("3-combo with two feral", async () => {
            let {room, clients} = await setupRoom(colyseus, 2);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.clear()
            room.state.players[0].cards.push(Card.TACOCAT, Card.FERALCAT, Card.FERALCAT);
            room.state.players[1].cards.clear()
            room.state.players[1].cards.push(Card.IMPLODING);
            await room.waitForNextPatch();

            clients[0].send("playCombo", {
                cards: [Card.TACOCAT, Card.FERALCAT, Card.FERALCAT],
                target: 1,
                targetCard: Card.IMPLODING
            });
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 0);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 1);
            assert.strictEqual(room.state.players[1].toJSON().cards.length, 0);
        });

        it("5-combo", async () => {
            let {room, clients} = await setupRoom(colyseus, 2);
            clients[0].send("start");

            await room.waitForNextPatch();

            room.state.players[0].cards.clear()
            room.state.players[0].cards.push(Card.TACOCAT, Card.CATTERMELON, Card.RAINBOWCAT, Card.BEARDCAT, Card.POTATOCAT);
            room.state.discard.push(Card.TARGETEDATTACK, Card.FAVOUR, Card.TARGETEDATTACK);
            await room.waitForNextPatch();

            clients[0].send("playCombo", {
                cards: [Card.TACOCAT, Card.CATTERMELON, Card.RAINBOWCAT, Card.BEARDCAT, Card.POTATOCAT],
                targetCard: Card.FAVOUR
            });
            await waitForNopeCooldown(room);

            assert.strictEqual(room.state.turnState, TurnState.Normal);
            assert.strictEqual(room.state.turnIndex, 0);
            assert.strictEqual(room.state.players[0].toJSON().cards.length, 1);
            assert.ok(room.state.players[0].cards.includes(Card.FAVOUR))
        });
    })

    it("nope", async () => {
        let {room, clients} = await setupRoom(colyseus);
        clients[0].send("start");

        await room.waitForNextPatch();

        room.state.players[0].cards.push(Card.SKIP);
        room.state.players[1].cards.push(Card.NOPE);
        await room.waitForNextPatch();

        clients[0].send("playCard", {card: Card.SKIP});
        await room.waitForNextPatch();

        clients[1].send("nope");
        await waitForNopeCooldown(room);

        assert.strictEqual(room.state.turnState, TurnState.Normal);
        assert.strictEqual(room.state.turnIndex, 0);
        assert.strictEqual(room.state.players[0].toJSON().cards.length, 5);
    });

    it("nope stack", async () => {
        let {room, clients} = await setupRoom(colyseus);
        clients[0].send("start");

        await room.waitForNextPatch();

        room.state.players[0].cards.push(Card.SKIP, Card.NOPE);
        room.state.players[1].cards.push(Card.NOPE);
        await room.waitForNextPatch();

        clients[0].send("playCard", {card: Card.SKIP});
        await room.waitForNextPatch();

        clients[1].send("nope");
        await room.waitForNextPatch();

        clients[0].send("nope");
        await waitForNopeCooldown(room);

        assert.strictEqual(room.state.turnState, TurnState.Normal);
        assert.strictEqual(room.state.turnIndex, 1);
        assert.strictEqual(room.state.players[0].toJSON().cards.length, 5);
    });

    it("exploding kitten", async () => {
        let {room, clients} = await setupRoom(colyseus);
        clients[0].send("start");

        await room.waitForNextPatch();

        room.state.deck = [Card.EXPLODING];
        room.state.players[1].cards.clear();
        await room.waitForNextPatch();

        clients[0].send("drawCard");
        await room.waitForNextPatch();

        assert.strictEqual(room.state.turnState, TurnState.ChoosingExplodingPosition);
        assert.strictEqual(room.state.turnIndex, 0);
        assert.strictEqual(room.state.players[0].toJSON().cards.length, 4);

        clients[0].send("choosePosition", {index: 0});
        await room.waitForNextPatch();

        assert.strictEqual(room.state.turnState, TurnState.Normal);
        assert.strictEqual(room.state.turnIndex, 1);
        assert.strictEqual(room.state.players[0].toJSON().cards.length, 4);

        clients[1].send("drawCard");
        await room.waitForNextPatch();

        assert.strictEqual(room.state.players.length, 2);
    });

    it("imploding kitten", async () => {
        let {room, clients} = await setupRoom(colyseus);
        clients[0].send("start");

        await room.waitForNextPatch();

        room.state.deck = [Card.IMPLODING];
        await room.waitForNextPatch();

        clients[0].send("drawCard");
        await room.waitForNextPatch();

        assert.strictEqual(room.state.turnState, TurnState.ChoosingImplodingPosition);
        assert.strictEqual(room.state.turnIndex, 0);

        clients[0].send("choosePosition", {index: 0});
        await room.waitForNextPatch();

        assert.strictEqual(room.state.turnState, TurnState.Normal);
        assert.strictEqual(room.state.turnIndex, 1);
        assert.strictEqual(room.state.players[0].toJSON().cards.length, 5);

        clients[1].send("drawCard");
        await room.waitForNextPatch();

        assert.strictEqual(room.state.players.length, 2);
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

function testBaseGameCards(allCards: Card[]) {
    assert.equal(allCards.filter(card => card === Card.TACOCAT).length, 4)
    assert.equal(allCards.filter(card => card === Card.BEARDCAT).length, 4)
    assert.equal(allCards.filter(card => card === Card.RAINBOWCAT).length, 4)
    assert.equal(allCards.filter(card => card === Card.POTATOCAT).length, 4)
    assert.equal(allCards.filter(card => card === Card.CATTERMELON).length, 4)
    assert.equal(allCards.filter(card => card === Card.ATTACK).length, 4)
    assert.equal(allCards.filter(card => card === Card.FAVOUR).length, 4)
    assert.equal(allCards.filter(card => card === Card.NOPE).length, 5)
    assert.equal(allCards.filter(card => card === Card.SHUFFLE).length, 4)
    assert.equal(allCards.filter(card => card === Card.SKIP).length, 4)
    assert.equal(allCards.filter(card => card === Card.SEETHEFUTURE).length, 5)
}

async function waitForNopeCooldown(room: Room<GameRoomState, any>) {
    await room.waitForNextPatch();
    while (room.state.turnState === TurnState.Noping) {
        await room.waitForNextPatch();
    }
}