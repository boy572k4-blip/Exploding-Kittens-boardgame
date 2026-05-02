import { Client, Room } from "@colyseus/core";
import { GamePlayer, GameRoomState, LobbyPlayer } from "./schema/GameRoomState";
import { Card, CardNames } from "../../shared/card";
import { isCatCard, TurnState } from "../../shared/util";

// https://stackoverflow.com/a/12646864/9094935
function shuffleArray(array: Array<any>) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

export class GameRoom extends Room<GameRoomState> {
    maxClients = 12;
    private nopeCallback?: () => void;
    // Track pending reconnection resolvers keyed by displayName
    private pendingReconnections = new Map<string, () => void>();
    // Track sessionIds that have been taken over by a new client (displayName → new sessionId)
    private rejoinedSessions = new Map<string, string>();

    async onCreate(options: { instanceId: string }) {
        this.setState(new GameRoomState());
        await this.setPrivate(true)
        this.roomId = options.instanceId;

        const verifyRes = await fetch(`https://discord.com/api/applications/${process.env.DISCORD_CLIENT_ID}/activity-instances/${options.instanceId}`, {
            headers: {
                "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            }
        });
        if (!verifyRes.ok && process.env.NODE_ENV === "production") {
            console.log(`[${this.roomId}] Instance ID verification failed!`);
            return;
        }

        this.log("initialised! [v2-reconnect-fix]")

        // Emoji reaction message
        this.onMessage("emoji", (client, message: { emoji: string }) => {
            // Broadcast emoji to all clients
            const playerIndex = this.state.players.toArray().findIndex(p => p.sessionId === client.sessionId);
            const spectatorIndex = this.state.spectators.toArray().findIndex(s => s.sessionId === client.sessionId);
            
            let playerName = 'Unknown';
            if (playerIndex !== -1) {
                playerName = this.state.players.at(playerIndex).displayName;
            } else if (spectatorIndex !== -1) {
                playerName = this.state.spectators.at(spectatorIndex).displayName;
            }

            this.broadcast("emoji", {
                emoji: message.emoji,
                playerName: playerName,
                sessionId: client.sessionId
            }, { except: client });

            this.log(`${playerName} sent emoji: ${message.emoji}`);
        });

        // Lobby messages
        this.onMessage("changeSettings", (client, message) => {
            if (this.state.ownerId === client.sessionId && !this.state.started) {
                this.state.isImplodingEnabled = message.isImplodingEnabled;
                this.state.nopeQTECooldown = message.nopeQTECooldown;
            }
        });

        this.onMessage("start", (client) => {
            if (this.state.ownerId !== client.sessionId || this.state.started || this.state.spectators.length < 2) {
                return;
            }

            this.state.started = true;

            const gameSize = Math.floor(this.state.spectators.length / (6 + +this.state.isImplodingEnabled)) + 1

            this.state.deck.push(
                ...Array(4 * gameSize).fill(Card.TACOCAT),
                ...Array(4 * gameSize).fill(Card.BEARDCAT),
                ...Array(4 * gameSize).fill(Card.RAINBOWCAT),
                ...Array(4 * gameSize).fill(Card.POTATOCAT),
                ...Array(4 * gameSize).fill(Card.CATTERMELON),
                ...Array(4 * gameSize).fill(Card.ATTACK),
                ...Array(4 * gameSize).fill(Card.FAVOUR),
                ...Array(5 * gameSize).fill(Card.NOPE),
                ...Array(4 * gameSize).fill(Card.SHUFFLE),
                ...Array(4 * gameSize).fill(Card.SKIP),
                ...Array(5 * gameSize).fill(Card.SEETHEFUTURE),
            );

            if (this.state.isImplodingEnabled) {
                this.state.deck.push(
                    ...Array(4 * gameSize).fill(Card.REVERSE),
                    ...Array(4 * gameSize).fill(Card.DRAWFROMBOTTOM),
                    ...Array(4 * gameSize).fill(Card.FERALCAT),
                    ...Array(4 * gameSize).fill(Card.ALTERTHEFUTURE),
                    ...Array(3 * gameSize).fill(Card.TARGETEDATTACK),
                )
            }

            shuffleArray(this.state.deck);

            this.state.spectators.forEach((spectator) => {
                const player = new GamePlayer();
                player.sessionId = spectator.sessionId;
                player.displayName = spectator.displayName;

                player.cards.push(...this.state.deck.splice(0, 4), Card.DEFUSE);

                this.state.players.push(player);
            })

            this.state.spectators.clear();
            this.updatePlayerIndices();

            this.state.deck.push(
                ...Array(this.state.players.length - 2).fill(Card.EXPLODING),
                this.state.isImplodingEnabled ? Card.IMPLODING : Card.EXPLODING,
                ...Array((gameSize * 6) - this.state.players.length).fill(Card.DEFUSE)
            );

            shuffleArray(this.state.deck);
            this.state.deckLength = this.state.deck.length;

            this.state.setDistanceToImplosion(this.state.deck.indexOf(Card.IMPLODING));

            this.log("Game started!")
        });

        // Game messages
        this.onMessage("drawCard", (client) => {
            if (!this.state.started || !client.userData || this.state.turnIndex !== client.userData.playerIndex || this.state.turnState !== TurnState.Normal) return;

            // CRITICAL FIX: Check if deck is empty - game over
            if (this.state.deck.length === 0) {
                this.log("Deck is empty! Game over - remaining players win!");
                this.state.turnState = TurnState.GameOver;
                return;
            }

            let card = this.state.deck.shift();

            // FIXED: Check if card is undefined (shouldn't happen but safety check)
            if (card === undefined) {
                this.log("ERROR: Drew undefined card from deck!");
                return;
            }

            this.state.deckLength = this.state.deck.length;
            this.state.setDistanceToImplosion(this.state.distanceToImplosion - 1);
            
            // CRITICAL FIX: Don't add Exploding/Imploding to hand, check for death first
            if (card === Card.EXPLODING || card === Card.IMPLODING) {
                this.checkCardForDeath(card, true);
            } else {
                this.state.players.at(this.state.turnIndex).cards.push(card);
                this.endTurn();
            }
        })

        this.onMessage("playCard", (client, message: { card: Card, target?: number }) => {
            if (!this.state.started || !client.userData || this.state.turnIndex !== client.userData.playerIndex || this.state.turnState !== TurnState.Normal) return;
            
            // CRITICAL FIX: Validate card is playable BEFORE removing from hand
            // Cards that cannot be played manually
            if ([Card.DEFUSE, Card.EXPLODING, Card.IMPLODING].includes(message.card)) {
                this.log("Invalid card - cannot be played manually: " + CardNames.get(message.card));
                return;
            }
            
            // Cat cards cannot be played alone
            if (isCatCard(message.card)) {
                this.log("Invalid card - cat cards must be played as combo: " + CardNames.get(message.card));
                return;
            }
            
            if (!this.state.players.at(this.state.turnIndex).cards.deleteAt(this.state.players[this.state.turnIndex].cards.indexOf(message.card))) return;

            this.log("Player " + client.sessionId + " playing " + CardNames.get(message.card) + " target " + message.target);

            this.state.discard.push(message.card);

            if ([Card.FAVOUR, Card.TARGETEDATTACK].includes(message.card)) this.broadcast("cardTarget", { target: message.target });

            this.processNopeQTE(() => {
                switch (message.card) {
                    case Card.ATTACK:
                    case Card.TARGETEDATTACK:
                        // FIXED: Validate target for TARGETEDATTACK
                        if (message.card === Card.TARGETEDATTACK) {
                            if (message.target === undefined || message.target < 0 || message.target >= this.state.players.length) {
                                this.log("Invalid targeted attack target!");
                                return;
                            }
                        }

                        if (this.state.attacked) {
                            this.state.turnRepeats += 2;
                        } else {
                            this.state.turnRepeats = 2;
                        }
                        this.state.turnCount++;
                        this.state.attacked = true;
                        this.state.turnIndex = message.card == Card.TARGETEDATTACK ?
                            message.target : // Use target
                            (this.state.turnIndex + this.state.turnOrder + this.state.players.length) % this.state.players.length; // Use next player, see endTurn for explanation
                        break;

                    case Card.SHUFFLE:
                        shuffleArray(this.state.deck);
                        this.state.setDistanceToImplosion(this.state.deck.indexOf(Card.IMPLODING));
                        this.broadcast("shuffled")
                        break;

                    case Card.SKIP:
                        this.endTurn();
                        break;

                    case Card.REVERSE:
                        this.state.turnOrder *= -1;
                        this.endTurn();
                        break;

                    case Card.DRAWFROMBOTTOM:
                        // CRITICAL FIX: Check if deck is empty - game over
                        if (this.state.deck.length === 0) {
                            this.log("Deck is empty! Game over - remaining players win!");
                            this.state.turnState = TurnState.GameOver;
                            return;
                        }

                        let card = this.state.deck.pop();

                        // FIXED: Check if card is undefined
                        if (card === undefined) {
                            this.log("ERROR: Drew undefined card from bottom!");
                            return;
                        }

                        this.state.deckLength = this.state.deck.length;
                        this.state.setDistanceToImplosion(this.state.distanceToImplosion); // Recalculate distance estimator
                        
                        // CRITICAL FIX: Don't add Exploding/Imploding to hand, check for death first
                        if (card === Card.EXPLODING || card === Card.IMPLODING) {
                            this.checkCardForDeath(card, true);
                        } else {
                            this.state.players.at(this.state.turnIndex).cards.push(card);
                            this.endTurn();
                        }
                        break;

                    case Card.ALTERTHEFUTURE:
                        this.state.turnState = TurnState.AlteringTheFuture;
                    // noinspection FallThroughInSwitchStatementJS
                    case Card.SEETHEFUTURE:
                        client.send("theFuture", { cards: this.state.deck.slice(0, 3) });
                        break;


                    case Card.FAVOUR:
                        // FIXED: Validate target player index
                        if (message.target === undefined || message.target < 0 || message.target >= this.state.players.length) {
                            this.log("Invalid favour target!");
                            return;
                        }
                        this.state.turnState = TurnState.Favouring;
                        this.clients.getById(this.state.players.at(message.target).sessionId).send("favourRequest");

                        // FIXED: Add timeout for favour response to prevent game hanging
                        const favourTimeout = setTimeout(() => {
                            if (this.state.turnState === TurnState.Favouring) {
                                this.log("Favour request timed out, forcing random card");
                                const targetPlayer = this.state.players.at(message.target);
                                if (targetPlayer && targetPlayer.cards.length > 0) {
                                    const randomIndex = Math.floor(Math.random() * targetPlayer.cards.length);
                                    const randomCard = targetPlayer.cards[randomIndex];
                                    targetPlayer.cards.deleteAt(randomIndex);
                                    this.state.players.at(this.state.turnIndex).cards.push(randomCard);
                                }
                                this.state.turnState = TurnState.Normal;
                            }
                        }, 30000); // 30 second timeout

                        // Store timeout so it can be cleared
                        this.state.favourTimeout = favourTimeout;
                        break;

                    default:
                        this.log("Invalid card!");
                        return;

                }
            })
        });

        this.onMessage("playCombo", (client, message: {
            cards: Array<Card>,
            target?: number,
            targetCard?: Card,
            cardIndex?: number,
        }) => {
            if (!this.state.started || !client.userData || this.state.turnIndex !== client.userData.playerIndex || this.state.turnState !== TurnState.Normal) return;

            // CRITICAL FIX: Validate combo cards are all cat cards
            if (!message.cards.every(card => isCatCard(card))) {
                this.log("Invalid combo - all cards must be cat cards");
                return;
            }

            // FIXED: Verify all cards exist in player's hand before processing
            const playerCards = this.state.players.at(this.state.turnIndex).cards;
            for (const card of message.cards) {
                if (!playerCards.includes(card)) {
                    this.log("Player doesn't have card: " + CardNames.get(card));
                    return;
                }
            }

            // Now remove the cards
            for (const card of message.cards) {
                if (!this.state.players.at(this.state.turnIndex).cards.deleteAt(this.state.players.at(this.state.turnIndex).cards.indexOf(card))) return;
                this.state.discard.push(card);
            }

            this.log("Player " + client.sessionId + " playing " + message.cards.map(card => CardNames.get(card)) + " target " + message.target);

            this.broadcast("comboTarget", { numCards: message.cards.length, ...message });

            this.processNopeQTE(() => {
                switch (message.cards.length) {
                    case 2:
                        if (new Set(message.cards).size === 1 || (message.cards.includes(Card.FERALCAT) && message.cards.every((c) => isCatCard(c)))) {
                            // FIXED: Validate target player index
                            if (message.target === undefined || message.target < 0 || message.target >= this.state.players.length) {
                                this.log("Invalid target player!");
                                return;
                            }

                            if (this.state.players.at(message.target).cards.length == 0) return;

                            // 2-card combo: Steal card at specific position (if provided) or random
                            let stealIndex: number;
                            if (message.cardIndex !== undefined && message.cardIndex >= 0 && message.cardIndex < this.state.players.at(message.target).cards.length) {
                                stealIndex = message.cardIndex;
                            } else {
                                stealIndex = ~~(Math.random() * this.state.players.at(message.target).cards.length);
                            }

                            let stolenCard = this.state.players.at(message.target).cards[stealIndex];
                            this.state.players.at(message.target).cards.deleteAt(stealIndex);
                            this.state.players.at(this.state.turnIndex).cards.push(stolenCard);
                            break;
                        }

                        this.log("Invalid combo!");
                        break;

                    case 3:
                        if (new Set(message.cards).size === 1 || (message.cards.includes(Card.FERALCAT) && message.cards.every((c) => isCatCard(c)) && new Set(message.cards).size === 2)) {
                            // FIXED: Validate target player index
                            if (message.target === undefined || message.target < 0 || message.target >= this.state.players.length) {
                                this.log("Invalid target player!");
                                return;
                            }

                            if (!this.state.players.at(message.target).cards.deleteAt(this.state.players.at(message.target).cards.indexOf(message.targetCard))) {
                                client.send("comboFail");
                                break;
                            }

                            this.state.players.at(this.state.turnIndex).cards.push(message.targetCard);
                            break;
                        }

                        this.log("Invalid combo!");
                        break;

                    case 5:
                        if (new Set(message.cards).size !== 5) {
                            this.log("Invalid combo!");
                            break;
                        }

                        // FIXED: Validate target card exists before modifying state
                        if (!message.targetCard || !this.state.discard.includes(message.targetCard)) {
                            this.log("Invalid choice - card not in discard!");
                            break;
                        }

                        // Note: Exploding/Imploding should never be in discard pile by design
                        // They are either in deck or removed from game when player dies
                        // So we don't need to check for them here

                        this.state.discard.deleteAt(this.state.discard.indexOf(message.targetCard));
                        this.state.players.at(this.state.turnIndex).cards.push(message.targetCard);
                        // No need to check for death since bombs are never in discard
                        break;

                    default:
                        this.log("Invalid combo!");
                        break;
                }
            })
        });

        this.onMessage("alterTheFuture", (client, message: { cards: Array<Card> }) => {
            if (!this.state.started || !client.userData || this.state.turnIndex !== client.userData.playerIndex || this.state.turnState !== TurnState.AlteringTheFuture) return;

            // FIXED: Validate cards array length and content
            if (!message.cards || message.cards.length !== 3) {
                this.log("Invalid alterTheFuture: must provide exactly 3 cards");
                return;
            }

            const top3 = this.state.deck.slice(0, 3);
            const sortedTop3 = [...top3].sort((a, b) => a - b);
            const sortedSelection = [...message.cards].sort((a, b) => a - b);
            if (JSON.stringify(sortedSelection) !== JSON.stringify(sortedTop3)) {
                this.log("Invalid alterTheFuture: cards do not match top 3 of deck");
                return;
            }

            this.state.deck.splice(0, 3, ...message.cards);
            this.state.turnState = TurnState.Normal;
        });

        this.onMessage("nope", (client) => {
            if (this.state.turnState !== TurnState.Noping || !client.userData) return;
            
            // CRITICAL FIX: Validate playerIndex
            const playerIndex = client.userData.playerIndex;
            if (playerIndex < 0 || playerIndex >= this.state.players.length) {
                this.log(`Invalid nope - playerIndex ${playerIndex} out of bounds`);
                return;
            }
            
            if (!this.state.players.at(playerIndex).cards.deleteAt(this.state.players.at(playerIndex).cards.indexOf(Card.NOPE))) return;

            this.state.discard.push(Card.NOPE);

            clearTimeout(this.state.nopeTimeout);
            this.state.noped = !this.state.noped;

            this.state.nopeTimeout = setTimeout(() => this.resolveNope(), this.state.nopeQTECooldown);
            if (!this.state.noped) {
                this.resolveNope();
            }
        });

        this.onMessage("favourResponse", (client, message: { card: Card }) => {
            if (this.state.turnState !== TurnState.Favouring || !client.userData) return;

            // CRITICAL FIX: Validate playerIndex
            const playerIndex = client.userData.playerIndex;
            if (playerIndex < 0 || playerIndex >= this.state.players.length) {
                this.log(`Invalid favourResponse - playerIndex ${playerIndex} out of bounds`);
                return;
            }

            if (!this.state.players.at(playerIndex).cards.deleteAt(this.state.players.at(playerIndex).cards.indexOf(message.card))) {
                this.log("Invalid card!");
                return;
            }

            this.state.players.at(this.state.turnIndex).cards.push(message.card);
            this.state.turnState = TurnState.Normal;

            // FIXED: Clear the favour timeout
            if (this.state.favourTimeout) {
                clearTimeout(this.state.favourTimeout);
                this.state.favourTimeout = undefined;
            }
        });

        this.onMessage("choosePosition", (client, message: { index: number }) => {
            if (!this.state.started || !client.userData || this.state.turnIndex !== client.userData.playerIndex) return;
            if (![TurnState.ChoosingImplodingPosition, TurnState.ChoosingExplodingPosition].includes(this.state.turnState)) return;

            // FIXED: Validate index bounds
            if (message.index < 0 || message.index > this.state.deck.length) {
                this.log(`Invalid position index: ${message.index}, deck length: ${this.state.deck.length}`);
                return;
            }

            this.log("Choosing position: index " + message.index)

            this.state.deck.splice(message.index, 0, this.state.turnState === TurnState.ChoosingImplodingPosition ? Card.IMPLODING : Card.EXPLODING);
            this.state.deckLength = this.state.deck.length;

            this.state.setDistanceToImplosion(this.state.deck.indexOf(Card.IMPLODING));
            this.state.turnState = TurnState.Normal;
            this.endTurn();
        })

        this.onMessage("returnToLobby", (client) => {
            if (!this.state.started || client.sessionId !== this.state.ownerId || this.state.turnState !== TurnState.GameOver) return;

            // FIXED: Move ALL players back to spectators, not just the first one
            while (this.state.players.length > 0) {
                const oldPlayer = this.state.players.splice(0, 1)[0];
                const spectator = new LobbyPlayer();
                spectator.sessionId = oldPlayer.sessionId;
                spectator.displayName = oldPlayer.displayName;
                this.state.spectators.push(spectator);
            }

            this.updatePlayerIndices();

            this.state.started = false;

            this.state.turnIndex = 0;
            this.state.turnCount = 0;
            this.state.turnRepeats = 1;
            this.state.turnOrder = 1;
            this.state.turnState = TurnState.Normal;

            // FIXED: Reset all turn-related flags
            this.state.attacked = false;

            this.state.discard.clear();

            this.state.implosionRevealed = false;

            this.state.deck = [];
            this.state.deckLength = this.state.deck.length;
        })
    }

    onJoin(client: Client, options: { displayName: string }, isReconnection?: boolean) {
        if (isReconnection) {
            this.log(`${client.sessionId} reconnected via Colyseus!`);

            // Find player in players array
            const playerIndex = this.state.players.toArray().findIndex(p => p.sessionId === client.sessionId);
            if (playerIndex !== -1) {
                client.userData = { playerIndex: playerIndex, isSpectator: false };
                this.state.playerIndexMap.set(client.sessionId, playerIndex);
                this.log(`Player ${client.sessionId} reconnected as player at index ${playerIndex}`);
            } else {
                // Check if they're a spectator
                const spectatorIndex = this.state.spectators.toArray().findIndex(s => s.sessionId === client.sessionId);
                if (spectatorIndex !== -1) {
                    client.userData = { playerIndex: spectatorIndex, isSpectator: true };
                    this.state.playerIndexMap.set(client.sessionId, -1);
                    this.log(`Player ${client.sessionId} reconnected as spectator at index ${spectatorIndex}`);
                }
            }
            return;
        }

        this.log(`${client.sessionId} joined with displayName: ${options.displayName}`);

        // If game is already started, try to match by displayName (handles page refresh / new sessionId)
        if (this.state.started) {
            this.log(`Game started, checking for existing player with displayName: ${options.displayName}`);
            this.log(`Players: ${this.state.players.toArray().map(p => p.displayName).join(', ')}`);
            this.log(`Spectators: ${this.state.spectators.toArray().map(s => s.displayName).join(', ')}`);
            this.log(`PendingReconnections keys: ${[...this.pendingReconnections.keys()].join(', ')}`);

            const playerIndex = this.state.players.toArray().findIndex(p => p.displayName === options.displayName);
            if (playerIndex !== -1) {
                const existingPlayer = this.state.players.at(playerIndex);
                const oldSessionId = existingPlayer.sessionId;

                // Update sessionId to new one
                existingPlayer.sessionId = client.sessionId;
                this.state.playerIndexMap.delete(oldSessionId);
                this.state.playerIndexMap.set(client.sessionId, playerIndex);
                client.userData = { playerIndex: playerIndex, isSpectator: false };

                // Transfer ownership if needed
                if (this.state.ownerId === oldSessionId) {
                    this.state.ownerId = client.sessionId;
                }

                // Mark old session as rejoined so onLeave skips removal
                this.rejoinedSessions.set(oldSessionId, client.sessionId);

                // Cancel any pending allowReconnection for this player
                const cancelReconnect = this.pendingReconnections.get(options.displayName);
                if (cancelReconnect) {
                    this.pendingReconnections.delete(options.displayName);
                    cancelReconnect();
                }

                // Remove any spectator clones with same displayName (created by race condition)
                const cloneIndices: number[] = [];
                this.state.spectators.toArray().forEach((s, i) => {
                    if (s.displayName === options.displayName) cloneIndices.push(i);
                });
                for (let i = cloneIndices.length - 1; i >= 0; i--) {
                    this.state.spectators.deleteAt(cloneIndices[i]);
                }
                // Remove duplicate players with same displayName (keep only the one we just updated)
                const dupPlayerIndices: number[] = [];
                this.state.players.toArray().forEach((p, i) => {
                    if (p.displayName === options.displayName && i !== playerIndex) dupPlayerIndices.push(i);
                });
                for (let i = dupPlayerIndices.length - 1; i >= 0; i--) {
                    this.state.players.deleteAt(dupPlayerIndices[i]);
                }
                this.updatePlayerIndices();

                this.log(`Player ${options.displayName} rejoined (new sessionId: ${client.sessionId}), restored hand with ${existingPlayer.cards.length} cards`);
                return;
            }

            // Also check spectators
            const spectatorIndex = this.state.spectators.toArray().findIndex(s => s.displayName === options.displayName);
            if (spectatorIndex !== -1) {
                const existingSpectator = this.state.spectators.at(spectatorIndex);
                const oldSessionId = existingSpectator.sessionId;

                existingSpectator.sessionId = client.sessionId;
                this.state.playerIndexMap.delete(oldSessionId);
                this.state.playerIndexMap.set(client.sessionId, -1);
                client.userData = { playerIndex: spectatorIndex, isSpectator: true };

                if (this.state.ownerId === oldSessionId) {
                    this.state.ownerId = client.sessionId;
                }

                // Mark old session as rejoined so onLeave skips removal
                this.rejoinedSessions.set(oldSessionId, client.sessionId);

                // Remove spectator clones with same displayName
                const cloneIndices: number[] = [];
                this.state.spectators.toArray().forEach((s, i) => {
                    if (s.displayName === options.displayName && i !== spectatorIndex) cloneIndices.push(i);
                });
                for (let i = cloneIndices.length - 1; i >= 0; i--) {
                    this.state.spectators.deleteAt(cloneIndices[i]);
                }
                this.updatePlayerIndices();

                this.log(`Spectator ${options.displayName} rejoined (new sessionId: ${client.sessionId})`);
                return;
            }
        }

        // New player joining
        if (!this.state.ownerId) {
            this.state.ownerId = client.sessionId;
        }

        const player = new LobbyPlayer();
        player.displayName = options.displayName;
        player.sessionId = client.sessionId;

        client.userData = { playerIndex: this.state.spectators.length, isSpectator: true };
        this.state.playerIndexMap.set(client.sessionId, -1);

        this.state.spectators.push(player);
    }

    async onLeave(client: Client, consented: boolean) {
        this.log(client.sessionId + ` left, consented=${consented}!`);

        // If this session was already taken over by a rejoining client, skip all removal logic
        if (this.rejoinedSessions.has(client.sessionId)) {
            this.log(`Skipping onLeave for ${client.sessionId} - already rejoined`);
            this.rejoinedSessions.delete(client.sessionId);
            this.state.playerIndexMap.delete(client.sessionId);
            return;
        }

        // For active game players, delay removal to allow F5 rejoin via displayName match
        if (this.state.started && !client.userData?.isSpectator) {
            const playerIndex = client.userData?.playerIndex;
            const displayName = playerIndex !== undefined
                ? this.state.players.at(playerIndex)?.displayName
                : undefined;

            this.log(`onLeave: playerIndex=${playerIndex}, displayName=${displayName}, isSpectator=${client.userData?.isSpectator}`);

            if (displayName) {
                this.log(`Waiting 15s for ${displayName} to rejoin...`);
                // Make room joinable so the reconnecting client can join
                await this.setPrivate(false);
                // Wait up to 15s for the player to rejoin (handles F5 and network drops)
                const rejoined = await new Promise<boolean>((resolve) => {
                    const timer = setTimeout(() => {
                        this.log(`Timer expired for ${displayName}`);
                        this.pendingReconnections.delete(displayName);
                        resolve(false);
                    }, 15000);

                    // onJoin will call this to cancel the timer
                    this.pendingReconnections.set(displayName, () => {
                        this.log(`Cancel timer called for ${displayName}`);
                        clearTimeout(timer);
                        this.pendingReconnections.delete(displayName);
                        resolve(true);
                    });
                });

                this.log(`${displayName} rejoined=${rejoined}, rejoinedSessions.has=${this.rejoinedSessions.has(client.sessionId)}`);

                if (rejoined || this.rejoinedSessions.has(client.sessionId)) {
                    this.log(`${displayName} rejoined, skipping removal`);
                    this.rejoinedSessions.delete(client.sessionId);
                    this.state.playerIndexMap.delete(client.sessionId);
                    // Re-lock the room
                    await this.setPrivate(true);
                    return;
                }

                this.log(`${displayName} did not rejoin within 10s, removing`);
                // Re-lock the room
                await this.setPrivate(true);
            }
        }

        // Player left permanently
        if (this.state.started) {
            if (!client.userData?.isSpectator) {
                this.removePlayer(client.userData.playerIndex, true);

                // Remove exploding card from deck
                let toRemove = this.state.deck.lastIndexOf(Card.EXPLODING);
                if (toRemove !== -1) {
                    this.state.deck = this.state.deck.filter((_, i) => i !== toRemove);
                    this.state.deckLength = this.state.deck.length;
                }
            } else {
                this.state.spectators.deleteAt(client.userData.playerIndex);
            }
        } else {
            this.state.spectators.deleteAt(client.userData.playerIndex);
        }

        if (client.sessionId === this.state.ownerId && (this.state.players.length + this.state.spectators.length) > 0) {
            if (this.state.started) {
                this.state.ownerId = this.state.players.at(0)?.sessionId;
            } else {
                this.state.ownerId = this.state.spectators.at(0)?.sessionId;
            }
        }

        this.state.playerIndexMap.delete(client.sessionId);
        this.updatePlayerIndices();
    }

    onDispose() {
        this.log("room " + this.roomId + " disposing...");
    }

    endTurn() {
        this.state.turnCount++;
        if (this.state.turnRepeats > 1) { // Attacked turn
            this.state.turnRepeats--;
        } else { // Normal turn OR end of attack
            this.state.attacked = false;
            this.state.turnIndex = (this.state.turnIndex + this.state.turnOrder + this.state.players.length) % this.state.players.length; // Cycle turns, js uses -1 % n = -1, so we must add n to make it positive
        }
        
        // CRITICAL FIX: Check if deck is empty after turn ends
        // When deck is empty, game is over and remaining players win
        if (this.state.deck.length === 0 && this.state.players.length > 1) {
            this.log("Deck is empty! Game over - remaining players win!");
            this.state.turnState = TurnState.GameOver;
        }
    }

    checkCardForDeath(card: Card, shouldEndTurnIfNormal: boolean) {
        // FIXED: Validate turnIndex before accessing
        if (this.state.turnIndex < 0 || this.state.turnIndex >= this.state.players.length) {
            this.log(`ERROR: Invalid turnIndex ${this.state.turnIndex}, players length: ${this.state.players.length}`);
            return;
        }

        if (card === Card.IMPLODING) {
            if (this.state.implosionRevealed) {
                // Second time drawing Imploding - instant death, no Defuse can save you
                // CRITICAL FIX: Imploding is removed from game when player dies (already shifted from deck)
                this.broadcast("imploded", { player: this.state.players.at(this.state.turnIndex).sessionId });
                this.removePlayer(this.state.turnIndex, true);
            } else {
                // First time - reveal it and let player choose where to put it back
                this.state.implosionRevealed = true;
                this.broadcast("implosionRevealed");
                this.state.turnState = TurnState.ChoosingImplodingPosition
            }
        } else if (card === Card.EXPLODING) {
            // Check if player has Defuse
            const defuseIndex = this.state.players.at(this.state.turnIndex).cards.indexOf(Card.DEFUSE);
            if (defuseIndex === -1) {
                // No Defuse - player dies
                // CRITICAL FIX: Exploding is removed from game when player dies (already shifted from deck)
                // This is intentional - reduces danger for remaining players
                this.broadcast("exploded", { player: this.state.players.at(this.state.turnIndex).sessionId });
                this.removePlayer(this.state.turnIndex, true);
            } else {
                // Has Defuse - use it and let player choose where to put Exploding back
                this.state.players.at(this.state.turnIndex).cards.deleteAt(defuseIndex);
                this.state.discard.push(Card.DEFUSE);
                this.broadcast("defused");
                this.state.turnState = TurnState.ChoosingExplodingPosition
            }
        } else {
            if (shouldEndTurnIfNormal) this.endTurn();
        }
    }

    removePlayer(index: number, createSpectator: boolean) {
        // FIXED: Validate index
        if (index < 0 || index >= this.state.players.length) {
            this.log(`ERROR: Invalid removePlayer index ${index}, players length: ${this.state.players.length}`);
            return;
        }

        this.state.players.at(index).cards.forEach((card) => {
            this.state.discard.push(card)
        })

        const deadPlayer = this.state.players.at(index)
        this.state.players.deleteAt(index);

        if (createSpectator) {
            // Don't create spectator if this player has already rejoined with a new session
            const hasRejoined = this.rejoinedSessions.has(deadPlayer.sessionId);
            if (!hasRejoined) {
                const spectator = new LobbyPlayer();
                spectator.sessionId = deadPlayer.sessionId;
                spectator.displayName = deadPlayer.displayName;
                this.state.spectators.push(spectator);
            } else {
                this.log(`Skipping spectator creation for ${deadPlayer.displayName} - already rejoined`);
            }
        }

        // CRITICAL FIX: Handle turnIndex adjustment based on removed player position
        if (this.state.turnIndex > index) {
            // Player removed before current turn → shift turnIndex back
            this.state.turnIndex--;
            this.log(`Adjusted turnIndex to ${this.state.turnIndex} after removing player at ${index}`);
        } else if (this.state.turnIndex === index) {
            // Current player was removed
            switch (this.state.turnState) {
                case TurnState.ChoosingExplodingPosition:
                case TurnState.ChoosingImplodingPosition:
                    // Put the bomb back at top of deck
                    this.state.deck.splice(0, 0, this.state.turnState === TurnState.ChoosingImplodingPosition ? Card.IMPLODING : Card.EXPLODING);
                    this.state.deckLength = this.state.deck.length;
                    this.state.setDistanceToImplosion(this.state.deck.indexOf(Card.IMPLODING));
                    break;
            }
            this.state.turnState = TurnState.Normal;

            // CRITICAL FIX: After removing current player, turnIndex now points to next player
            // (because array shifted left). We need to adjust if it's out of bounds.
            if (this.state.players.length > 0 && this.state.turnIndex >= this.state.players.length) {
                this.state.turnIndex = 0; // Wrap around to first player
            }
            this.log(`Current player removed, turnIndex now ${this.state.turnIndex}`);
        }
        // else: Player removed after current turn → no adjustment needed

        this.state.attacked = false;
        this.state.turnRepeats = 1; // Make sure next player only has one turn

        // FIXED: Check for division by zero
        if (this.state.players.length > 0) {
            this.state.turnIndex %= this.state.players.length; // Make sure turn index is valid
        } else {
            this.state.turnIndex = 0; // No players left
        }

        if (this.state.players.length === 1) {
            this.state.turnState = TurnState.GameOver;
        }

        this.updatePlayerIndices();
    }

    processNopeQTE(callback: () => void) {
        // FIXED: If nope is disabled, call callback immediately
        if (this.state.nopeQTECooldown === 0) {
            callback();
            return;
        }

        this.state.turnState = TurnState.Noping;
        this.nopeCallback = callback;
        this.state.noped = false;

        this.state.nopeTimeout = setTimeout(() => this.resolveNope(), this.state.nopeQTECooldown);
    }

    resolveNope() {
        if (this.state.nopeTimeout) {
            clearTimeout(this.state.nopeTimeout);
        }

        this.state.turnState = TurnState.Normal;

        if (!this.state.noped && this.nopeCallback) {
            const callback = this.nopeCallback;
            this.nopeCallback = undefined;
            callback();
        }

        this.state.noped = false;
    }

    updatePlayerIndices() {
        // Clear the entire playerIndexMap first to avoid stale entries
        this.state.playerIndexMap.clear();

        for (const [index, player] of this.state.players.toArray().entries()) {
            const client = this.clients.getById(player.sessionId);
            if (client) {
                client.userData = { playerIndex: index, isSpectator: false };
                this.state.playerIndexMap.set(player.sessionId, index);
            }
        }

        for (const [index, player] of this.state.spectators.toArray().entries()) {
            const client = this.clients.getById(player.sessionId);
            if (client) {
                client.userData = { playerIndex: index, isSpectator: true };
                this.state.playerIndexMap.set(player.sessionId, -1);
            }
        }
    }

    log(message: string) {
        console.log("[" + this.roomId + "] " + message)
    }
}