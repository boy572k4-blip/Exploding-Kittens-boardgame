import {useColyseusRoom, useColyseusState} from "../utility/contexts";
import {useEffect, useState} from "react";
import CardHand from "../components/cards/CardHand";
import {Card} from "../../../server/shared/card";
import {isCatCard, TurnState} from "../../../server/shared/util";
import GameModal, {ModalType} from "../components/game/GameModal";
import Deck from "../components/game/Deck";
import Discard from "../components/game/Discard";
import OpponentHand from "../components/game/OpponentHand";
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors
} from "@dnd-kit/core";
import {arrayMove, sortableKeyboardCoordinates} from "@dnd-kit/sortable";
import DroppableCard from "../components/cards/DroppableCard";

export default function Game() {
    // let {auth, discordSDK} = useContext(DiscordSDKContext);
    let room = useColyseusRoom();
    let turnState = useColyseusState(state => state.turnState);
    let turnIndex = useColyseusState(state => state.turnIndex) ?? -1;
    let playerIndexMap = useColyseusState(state => state.playerIndexMap) ?? new Map();
    let players = useColyseusState(state => state.players) ?? [];
    let spectators = useColyseusState(state => state.spectators) ?? [];
    let ownerId = useColyseusState(state => state.ownerId);
    let turnRepeats = useColyseusState(state => state.turnRepeats);

    // Convert to array for easier manipulation
    const playersArray = players ? Array.from(players) : [];
    
    // Use playerIndexMap - this is the source of truth from server
    let ourIndex = room ? (playerIndexMap.get(room.sessionId) ?? -1) : -1;
    
    // DEBUG: Log player index resolution
    if (room) {
        console.log('[Game] Player Index Debug:');
        console.log('  - Our sessionId:', room.sessionId);
        console.log('  - Our index from map:', ourIndex);
        console.log('  - PlayerIndexMap entries:', Array.from(playerIndexMap.entries()));
        console.log('  - Players array:', playersArray.map((p, i) => ({index: i, sessionId: p?.sessionId, name: p?.displayName, numCards: p?.numCards})));
    }
    
    let cardsSchema = playersArray[ourIndex]?.cards;
    let cards = cardsSchema ? cardsSchema.toArray() : [];

    // Get opponents in clockwise order starting from our position
    type OpponentData = {
        player: any;
        originalIndex: number;
    };
    let opponents: OpponentData[] = [];
    
    if (ourIndex >= 0 && playersArray.length > 1) {
        for (let i = 1; i < playersArray.length; i++) {
            const opponentIndex = (ourIndex + i) % playersArray.length;
            const player = playersArray[opponentIndex];
            if (player) {
                opponents.push({
                    player: player,
                    originalIndex: opponentIndex
                });
            }
        }
    }

    // Debug log
    console.log('[Game] Debug Info:');
    console.log('  - Total players:', playersArray.length);
    console.log('  - Our sessionId:', room?.sessionId);
    console.log('  - Our index:', ourIndex);
    console.log('  - Opponents count:', opponents.length);
    console.log('  - Opponents order:', opponents.map(o => ({index: o.originalIndex, name: o.player?.displayName})));
    console.log('  - PlayerIndexMap:', Array.from(playerIndexMap.entries()));
    console.log('  - All players:', playersArray.map((p, i) => ({index: i, sessionId: p?.sessionId, name: p?.displayName})));

    // Assign positions based on number of opponents
    // Positions follow clockwise order from player's perspective (bottom)
    // Clockwise: bottom (player) -> left -> top -> right -> bottom
    const getOpponentPosition = (index: number, total: number): {position: 'top' | 'left' | 'right', offset?: number} => {
        if (total === 1) return {position: 'top'};
        if (total === 2) return {position: index === 0 ? 'right' : 'top'};  // Next player on right (clockwise)
        if (total === 3) return {position: ['right', 'top', 'left'][index] as 'top' | 'left' | 'right'};  // Clockwise: right, top, left
        if (total === 4) {
            // 4 opponents clockwise: right, top-right, top-left, left
            const positions: Array<{position: 'top' | 'left' | 'right', offset?: number}> = [
                {position: 'right'},
                {position: 'top', offset: 150},   // top-right
                {position: 'top', offset: -150},  // top-left
                {position: 'left'}
            ];
            return positions[index];
        }
        if (total === 5) {
            // 5 opponents clockwise: right-bottom, right-top, top, left-top, left-bottom
            const positions: Array<{position: 'top' | 'left' | 'right', offset?: number}> = [
                {position: 'right', offset: 80},   // right-bottom
                {position: 'right', offset: -80},  // right-top
                {position: 'top'},                 // top center
                {position: 'left', offset: -80},   // left-top
                {position: 'left', offset: 80}     // left-bottom
            ];
            return positions[index];
        }
        if (total >= 6) {
            const positions: Array<{position: 'top' | 'left' | 'right', offset?: number}> = [
                {position: 'right', offset: 100},
                {position: 'right', offset: -100},
                {position: 'top', offset: 150},
                {position: 'top', offset: -150},
                {position: 'left', offset: -100},
                {position: 'left', offset: 100}
            ];
            return positions[index % 6];
        }
        return {position: 'top'};
    };

    let [selectedCardMask, setSelectedCardMask] = useState<Array<boolean>>([]);
    let [cardOrder, setCardOrder] = useState<Array<number>>([]);
    let [prevCards, setPrevCards] = useState<Array<Card>>([]);

    // Update card order when cards change (complicated!)
    if (cards.length !== prevCards.length || !cards.every((card, index) => prevCards[index] === card)) {
        let newCardOrder = structuredClone(cardOrder);
        if (prevCards.length > cards.length) { // Cards removed
            let removedIndices: number[] = [];
            prevCards.forEach((_, index) => {
                if (cards[index - removedIndices.length] !== prevCards[index]) {
                    removedIndices.push(index)
                }
            })

            newCardOrder = newCardOrder
                .filter(elem => !removedIndices.includes(elem))
                .map(elem => elem - removedIndices.filter(index => elem >= index).length)
        } else if (prevCards.length < cards.length) { // Cards added
            cards.slice(prevCards.length).forEach((_, index) => newCardOrder.push(prevCards.length + index));
        }

        setPrevCards(cards);
        setCardOrder(newCardOrder);
        setSelectedCardMask(cards.map(_ => false));
    }

    let selectedCards = cards.filter((_, index) => selectedCardMask[index]);
    const isPlayAllowed = !!room && isPlayValid(selectedCards) && turnState === TurnState.Normal && playerIndexMap.get(room.sessionId) === turnIndex;

    let [currentModal, setCurrentModal] = useState(ModalType.None);
    let [theFuture, setTheFuture] = useState<Card[]>([])

    useEffect(() => {
        if (!room) return () => {}

        const listeners: Array<() => void> = []

        // Listen to schema changes
        listeners.push(
            room.state.listen("turnState", (currentValue) => {
                if ([TurnState.ChoosingImplodingPosition, TurnState.ChoosingExplodingPosition].includes(currentValue) && (turnIndex === ourIndex)) {
                    setCurrentModal(ModalType.ChoosePosition);
                }

                if (currentValue === TurnState.GameOver && ownerId === room.sessionId) {
                    setTimeout(() => {
                        room.send("returnToLobby");
                    }, 5000);
                }
            }, true),

            room.state.listen("ownerId", (currentValue) => {
                if (currentValue === room.sessionId && turnState === TurnState.GameOver) {
                    setTimeout(() => {
                        room.send("returnToLobby");
                    }, 5000);
                }
            }),

            room.onMessage("favourRequest", () => {
                setCurrentModal(ModalType.Favour);
            }),

            room.onMessage("theFuture", (message) => {
                setCurrentModal(ModalType.TheFuture);
                setTheFuture(message.cards)
            })
        );

        return () => {
            listeners.forEach(removeCallback => {
                removeCallback()
            });
        }
    }, [turnIndex, ownerId, room]);

    function playCallback(targetSessionId?: string, targetCard?: Card, cardIndex?: number) {
        if (!room || !playerIndexMap) return;

        switch (selectedCards.length) {
            case 1:
                if (!targetSessionId) return;
                room.send("playCard", {card: selectedCards[0], target: playerIndexMap.get(targetSessionId)});
                break;
            case 2:
                // 2-card combo: Need target player AND card position (index)
                if (!targetSessionId) return;
                if (cardIndex === undefined) {
                    setCurrentModal(ModalType.TargetCardPosition);
                    return;
                }
                room.send("playCombo", {
                    cards: selectedCards,
                    target: playerIndexMap.get(targetSessionId),
                    cardIndex: cardIndex
                });
                break;
            case 3:
                // 3-card combo: Need target player AND specific card name
                if (!targetSessionId) return;
                if (!targetCard) {
                    setCurrentModal(ModalType.TargetCard);
                    return;
                }
                room.send("playCombo", {
                    cards: selectedCards,
                    target: playerIndexMap.get(targetSessionId),
                    targetCard: targetCard
                });
                break;
            case 5:
                if (!targetCard) return;
                room.send("playCombo", {cards: selectedCards, targetCard: targetCard});
                break;
        }

        // FIXED: Clear selection when modal closes
        setCurrentModal(ModalType.None);
        setSelectedCardMask(cards.map(_ => false));
    }

    // Drag and drop handlers
    const [activeId, setActiveId] = useState<number>();

    function handleDragStart(event: DragStartEvent) {
        const {active} = event;

        setActiveId(active.id as number - 1); // ids cannot be 0, so are shifted by 1
    }

    function handleDragEnd(event: DragEndEvent) {
        const {active, over} = event;
        setActiveId(undefined);

        if (!over) return;

        if (over.id == 'discard-pile') {
            if (playerIndexMap == undefined || room == undefined) return;

            // Handle NOPE cards during noping phase - PRIORITY CHECK
            if (turnState === TurnState.Noping && selectedCards.includes(Card.NOPE) && selectedCards.length == 1) {
                room.send("nope");
                setSelectedCardMask(cards.map(_ => false));
                return;
            }

            // Simplified card playing - just play the selected cards directly
            if (isPlayAllowed && selectedCards.length > 0) {
                playCardsDirectly();
                return;
            }
        }

        if (active.id !== over.id) {
            setCardOrder((prevOrder) => {
                const oldIndex = prevOrder.indexOf(active.id as number - 1); // ids cannot be 0, so are shifted by 1
                const newIndex = prevOrder.indexOf(over.id as number - 1);

                return arrayMove(prevOrder, oldIndex, newIndex);
            });
        }
    }

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 4
            }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    function playCardsDirectly() {
        if (!room || !playerIndexMap) return;

        // For cards that don't need targets, play them directly
        if (selectedCards.length === 1) {
            const card = selectedCards[0];
            
            // Cards that need no target
            if (![Card.FAVOUR, Card.TARGETEDATTACK].includes(card)) {
                room.send("playCard", {card: card});
                setSelectedCardMask(cards.map(_ => false));
                return;
            }
            
            // For cards that need targets, show modal
            setCurrentModal(ModalType.TargetPlayer);
            return;
        }
        
        // For combos, show target player modal first
        if (selectedCards.length === 2 || selectedCards.length === 3) {
            setCurrentModal(ModalType.TargetPlayer);
            return;
        }
        
        // For 5-card combos, show discard pile modal
        if (selectedCards.length === 5) {
            setCurrentModal(ModalType.TargetDiscard);
            return;
        }
        
        // If we can't play the cards directly, clear selection
        setSelectedCardMask(cards.map(_ => false));
    }

    function handleLeaveRoom() {
        if (room) {
            room.leave(true); // true = consent to leave, don't allow reconnection
        }
        // Clear stored data
        localStorage.removeItem('playerName');
        localStorage.removeItem('playerAvatar');
        // Redirect to home
        window.location.href = '/';
    }

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            {/* Leave room button - fixed position top right */}
            <button 
                onClick={handleLeaveRoom}
                className="fixed top-4 right-4 z-50 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-md transition-colors shadow-lg"
                title="Rời phòng"
            >
                ❌ Rời phòng
            </button>

            {/* Mini player */}
            <div className="h-full sm:hidden flex flex-col justify-center text-center p-6 align-middle">
                <div className={"border rounded-md p-4 backdrop-blur w-fit m-auto"}>
                    <p>Người chơi ({playersArray.length}): {playersArray.map((player, idx) => player ? `${player.displayName}${idx === ourIndex ? ' (BẠN)' : ''} (${player.numCards} lá)` : 'Unknown').join(", ")}</p>
                    {spectators.length > 0 ?
                        <p>Người xem: {spectators.map(player => player?.displayName ?? 'Unknown').join(", ")}</p> : null}

                    <p>{"Lượt của " + (turnIndex === ourIndex ? "bạn" : (playersArray[turnIndex]?.displayName ?? 'Unknown')) + " x" + turnRepeats}</p>
                </div>
            </div>
            <div className="h-full hidden sm:block">
                <GameModal type={currentModal} playCallback={playCallback}
                           closeCallback={() => setCurrentModal(ModalType.None)}
                           theFuture={theFuture}/>
                
                {/* Opponents around the table */}
                {opponents.map((opponentData, index) => {
                    const positionData = getOpponentPosition(index, opponents.length);
                    return (
                        <OpponentHand
                            key={opponentData.player.sessionId}
                            playerName={opponentData.player.displayName}
                            numCards={opponentData.player.numCards}
                            position={positionData.position}
                            offset={positionData.offset}
                            isCurrentTurn={opponentData.originalIndex === turnIndex}
                        />
                    );
                })}

                <div className={"flex items-center text-center justify-center h-full"}>
                    <div className={"flex flex-col"}>
                        <div className={"border rounded-md p-4 backdrop-blur backdrop-brightness-50 w-fit m-auto"}>
                            <p>Người chơi ({playersArray.length}): {playersArray.map((player, idx) => player ? `${player.displayName}${idx === ourIndex ? ' (BẠN)' : ''} (${player.numCards} lá)` : 'Unknown').join(", ")}</p>
                            {spectators.length > 0 ?
                                <p>Người xem: {spectators.map(player => player?.displayName ?? 'Unknown').join(", ")}</p> : null}

                            <p>{"Lượt của " + (turnIndex === ourIndex ? "bạn" : (playersArray[turnIndex]?.displayName ?? 'Unknown')) + " x" + turnRepeats}</p>
                            
                            {/* NOPE notification */}
                            {turnState === TurnState.Noping && cards.includes(Card.NOPE) && (
                                <div className="mt-2 p-2 bg-red-600 text-white rounded-md animate-pulse">
                                    ⚠️ Kéo thả lá NOPE để phản đối!
                                </div>
                            )}
                        </div>

                        <div className={"flex flex-row justify-center md:gap-20 gap-10"}>
                            <Deck drawCallback={() => room && room.send("drawCard")}
                                  drawDisabled={!room || turnState !== TurnState.Normal || playerIndexMap.get(room.sessionId) !== turnIndex}/>

                            <Discard/>
                        </div>

                        <CardHand cards={cards} selectedCardMask={selectedCardMask}
                                  setSelectedCardMask={setSelectedCardMask} cardOrder={cardOrder}
                                  activeId={activeId} isPlayAllowed={isPlayAllowed}/>
                    </div>
                    <DragOverlay>
                        {activeId !== undefined ?
                            <DroppableCard card={cards[activeId]} selectedCards={selectedCards}
                                           isPlayAllowed={isPlayAllowed}/> : null}
                    </DragOverlay>
                </div>
            </div>
        </DndContext>
    )
}

function isPlayValid(cards: Array<Card>) {
    switch (cards.length) {
        case 1:
            return ![Card.DEFUSE, Card.NOPE].includes(cards[0]) && !isCatCard(cards[0]);
        case 2:
            return new Set(cards).size === 1 || (cards.includes(Card.FERALCAT) && cards.every((c) => isCatCard(c)));
        case 3:
            return new Set(cards).size === 1 || (cards.includes(Card.FERALCAT) && cards.every((c) => isCatCard(c)) && new Set(cards).size === 2);
        case 5:
            return new Set(cards).size === 5;
    }
    return false;
}
