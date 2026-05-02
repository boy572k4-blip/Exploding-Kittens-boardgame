import {useColyseusRoom, useColyseusState} from "../utility/contexts";
import {useEffect, useState} from "react";
import CardHand from "../components/cards/CardHand";
import {Card} from "../../../server/shared/card";
import {isCatCard, TurnState} from "../../../server/shared/util";
import GameModal, {ModalType} from "../components/game/GameModal";
import Deck from "../components/game/Deck";
import Discard from "../components/game/Discard";
import OpponentHand from "../components/game/OpponentHand";
import EmojiPicker from "../components/game/EmojiPicker";
import EmojiAnimation from "../components/game/EmojiAnimation";
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
    console.log('  - Opponents order:', opponents.map(o => ({index: o.originalIndex, name: o.player?.displayName, numCards: o.player?.numCards})));
    console.log('  - PlayerIndexMap:', Array.from(playerIndexMap.entries()));
    console.log('  - All players:', playersArray.map((p, i) => ({
        index: i, 
        sessionId: p?.sessionId, 
        displayName: p?.displayName,
        displayNameType: typeof p?.displayName,
        numCards: p?.numCards
    })));
    console.log('  - Raw players object:', players);

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
    let [theFuture, setTheFuture] = useState<Card[]>([]);
    
    // Emoji state
    type EmojiData = {
        id: number;
        emoji: string;
        playerName: string;
        position: { x: number; y: number };
    };
    let [emojis, setEmojis] = useState<EmojiData[]>([]);
    let [emojiIdCounter, setEmojiIdCounter] = useState(0);

    useEffect(() => {
        if (!room) return () => {}

        const listeners: Array<() => void> = []

        // Listen to emoji messages
        listeners.push(
            room.onMessage("emoji", (message: { emoji: string; playerName: string; sessionId: string }) => {
                // Find player position to show emoji
                const playerIndex = playersArray.findIndex(p => p?.sessionId === message.sessionId);
                let position = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
                
                if (playerIndex !== -1) {
                    // Calculate position based on player index
                    // Center for now, can be improved to show near player avatar
                    position = {
                        x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
                        y: window.innerHeight / 2 + (Math.random() - 0.5) * 200
                    };
                }
                
                const newEmoji: EmojiData = {
                    id: emojiIdCounter,
                    emoji: message.emoji,
                    playerName: message.playerName,
                    position
                };
                
                setEmojiIdCounter(prev => prev + 1);
                setEmojis(prev => [...prev, newEmoji]);
            })
        );

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

    function handleEmojiSelect(emoji: string) {
        if (!room) return;
        room.send("emoji", { emoji });
        
        // Show emoji for self
        const ourPlayer = playersArray[ourIndex];
        if (ourPlayer) {
            const newEmoji: EmojiData = {
                id: emojiIdCounter,
                emoji: emoji,
                playerName: ourPlayer.displayName || 'You',
                position: {
                    x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
                    y: window.innerHeight / 2 + (Math.random() - 0.5) * 200
                }
            };
            setEmojiIdCounter(prev => prev + 1);
            setEmojis(prev => [...prev, newEmoji]);
        }
    }

    function handleEmojiComplete(id: number) {
        setEmojis(prev => prev.filter(e => e.id !== id));
    }

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            {/* Emoji animations */}
            {emojis.map(emojiData => (
                <EmojiAnimation
                    key={emojiData.id}
                    emoji={emojiData.emoji}
                    playerName={emojiData.playerName}
                    position={emojiData.position}
                    onComplete={() => handleEmojiComplete(emojiData.id)}
                />
            ))}

            {/* Emoji picker */}
            <EmojiPicker onEmojiSelect={handleEmojiSelect} />

            {/* Leave room button - fixed position top right */}
            <button 
                onClick={handleLeaveRoom}
                className="fixed top-4 right-4 z-50 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-md transition-colors shadow-lg"
                title="Rời phòng"
            >
                ❌ Rời phòng
            </button>

            {/* Mini player - mobile view improved */}
            <div className="h-full sm:hidden flex flex-col justify-center text-center p-6 align-middle">
                <div className={"border-2 rounded-xl p-5 backdrop-blur-md w-fit m-auto shadow-2xl bg-black/30"}>
                    {/* Current turn */}
                    <div className={`mb-4 p-3 rounded-lg ${
                        turnIndex === ourIndex 
                            ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-black' 
                            : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                    } shadow-lg`}>
                        <div className="font-bold text-base">
                            {turnIndex === ourIndex ? '🎯 LƯỢT CỦA BẠN' : `🎮 Lượt: ${playersArray[turnIndex]?.displayName || 'Player'}`}
                        </div>
                        {turnRepeats && turnRepeats > 1 && <div className="text-sm">⚡ x{turnRepeats}</div>}
                    </div>

                    {/* Players */}
                    <div className="space-y-2">
                        {playersArray.map((player, idx) => {
                            if (!player) return null;
                            const name = player.displayName || `Player ${idx + 1}`;
                            const isYou = idx === ourIndex;
                            const isTurn = idx === turnIndex;
                            const cardCount = player.numCards || 0;
                            
                            const firstLetter = name[0].toUpperCase();
                            const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500'];
                            const avatarColor = colors[name.charCodeAt(0) % colors.length];
                            
                            return (
                                <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${
                                    isTurn ? 'bg-yellow-400 text-black' : isYou ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'
                                }`}>
                                    <div className={`${avatarColor} w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                                        {firstLetter}
                                    </div>
                                    <div className="flex-1 text-left text-sm">
                                        <div className="font-bold">{name} {isYou && '(BẠN)'}</div>
                                        <div className="text-xs">🃏 {cardCount} lá</div>
                                    </div>
                                    {isTurn && <div className="text-lg">👉</div>}
                                </div>
                            );
                        })}
                    </div>

                    {spectators.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-600 text-gray-300 text-xs">
                            👁️ Xem: {spectators.map(p => p?.displayName || 'Unknown').join(", ")}
                        </div>
                    )}
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
                        {/* Player info panel - improved */}
                        <div className={"border-2 rounded-xl p-5 backdrop-blur-md backdrop-brightness-50 w-fit m-auto shadow-2xl bg-black/30"}>
                            {/* Current turn indicator - prominent */}
                            <div className={`mb-4 p-3 rounded-lg ${
                                turnIndex === ourIndex 
                                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-black animate-pulse' 
                                    : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                            } shadow-lg`}>
                                <div className="text-lg font-bold">
                                    {turnIndex === ourIndex ? '🎯 LƯỢT CỦA BẠN' : `🎮 Lượt của ${playersArray[turnIndex]?.displayName || `Player ${turnIndex + 1}`}`}
                                </div>
                                <div className="text-sm mt-1">
                                    {turnRepeats && turnRepeats > 1 ? `⚡ ${turnRepeats} lượt liên tiếp` : ''}
                                </div>
                            </div>

                            {/* Players list with avatars */}
                            <div className="space-y-2">
                                <div className="text-white font-bold text-sm mb-2">👥 NGƯỜI CHƠI ({playersArray.length})</div>
                                {playersArray.map((player, idx) => {
                                    if (!player) return null;
                                    const name = player.displayName || `Player ${idx + 1}`;
                                    const isYou = idx === ourIndex;
                                    const isTurn = idx === turnIndex;
                                    const cardCount = player.numCards || 0;
                                    
                                    // Generate avatar
                                    const firstLetter = name[0].toUpperCase();
                                    const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500'];
                                    const avatarColor = colors[name.charCodeAt(0) % colors.length];
                                    
                                    return (
                                        <div key={idx} className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
                                            isTurn 
                                                ? 'bg-yellow-400 text-black scale-105 shadow-lg' 
                                                : isYou 
                                                    ? 'bg-blue-600 text-white' 
                                                    : 'bg-gray-700 text-white'
                                        }`}>
                                            {/* Avatar */}
                                            <div className={`${avatarColor} w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md ${
                                                isTurn ? 'ring-2 ring-black' : ''
                                            }`}>
                                                {firstLetter}
                                            </div>
                                            
                                            {/* Info */}
                                            <div className="flex-1 text-left">
                                                <div className="font-bold text-sm">
                                                    {name} {isYou && '(BẠN)'}
                                                </div>
                                                <div className="text-xs opacity-90">
                                                    🃏 {cardCount} lá bài
                                                </div>
                                            </div>
                                            
                                            {/* Turn indicator */}
                                            {isTurn && (
                                                <div className="text-xl animate-bounce">
                                                    👉
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Spectators */}
                            {spectators.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-600">
                                    <div className="text-gray-300 text-sm">
                                        👁️ Người xem: {spectators.map(player => player?.displayName || 'Unknown').join(", ")}
                                    </div>
                                </div>
                            )}
                            
                            {/* NOPE notification */}
                            {turnState === TurnState.Noping && cards.includes(Card.NOPE) && (
                                <div className="mt-4 p-3 bg-red-600 text-white rounded-lg animate-pulse shadow-lg">
                                    <div className="font-bold text-lg">⚠️ CƠ HỘI NOPE!</div>
                                    <div className="text-sm mt-1">Kéo thả lá NOPE để phản đối!</div>
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
