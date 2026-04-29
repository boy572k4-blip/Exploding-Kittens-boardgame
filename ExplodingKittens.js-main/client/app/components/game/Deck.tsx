import CardComponent from "../cards/CardComponent";
import {Card} from "../../../../server/shared/card";
import {useEffect, useRef, useState} from "react";
import {useColyseusRoom, useColyseusState} from "../../utility/contexts";
import {
    cardSeparation,
    fanAngleX,
    fanAngleZOffset,
    fanLimit,
    initialAngleX,
    initialAngleZ,
    randomOffsetFactor, topCardHoverZ
} from "../../utility/constants";

/**
 * Visual deck showing all remaining cards. Fans out when cards remaining < fanLimit, has random offsets, hovers top card if drawing is allowed, shuffles
 *
 * @param drawCallback Function to call when a card is drawn
 * @param drawDisabled Whether drawing a card is currently allowed
 * @constructor
 */
export default function Deck({drawCallback, drawDisabled}: { drawCallback: () => void, drawDisabled: boolean }) {
    let [angleX, setAngleX] = useState(initialAngleX);
    let [angleZ, setAngleZ] = useState(initialAngleZ);
    let [angleZOffset, setAngleZOffset] = useState(0);
    let [topCardTranslate, setTopCardTranslate] = useState([0, 0, 0]);

    let [drawing, setDrawing] = useState(false);
    let [suspendTransition, setSuspendTransition] = useState(false); // Transitions should be suspended while the top card changes

    let cardsInDeck = useColyseusState(state => state.deckLength) ?? 0;
    let [lastCardsInDeck, setLastCardsInDeck] = useState(0);

    if (lastCardsInDeck !== cardsInDeck) {
        setLastCardsInDeck(cardsInDeck);

        if (suspendTransition) { // If a card has been drawn by this player, transitions should be suspended
            setTopCardTranslate([0, 0, 0]); // The card has been drawn, so return it to the top of the deck
            setDrawing(false); // Signify that drawing is complete
        }
    }

    useEffect(() => {
        if (suspendTransition && !drawing) setTimeout(() => setSuspendTransition(false), 200); // Resume transitions after the card has returned
    }, [suspendTransition, drawing]);

    // Logic to keep track of shuffle positions and aesthetic offsets
    let [shufflePositions, setShufflePositions] = useState(new Array(cardsInDeck).fill(0).map(_ => [0, 0]));
    let randomOffsets = useRef(new Array(cardsInDeck).fill(0).map(_ => [(Math.random() - 0.5) * randomOffsetFactor, (Math.random() - 0.5) * randomOffsetFactor]));

    let newShufflePositions = structuredClone(shufflePositions);
    while (newShufflePositions.length < cardsInDeck) {
        randomOffsets.current = randomOffsets.current.concat([[(Math.random() - 0.5) * randomOffsetFactor, (Math.random() - 0.5) * randomOffsetFactor]]);
        newShufflePositions.push([0, 0])
    }
    while (newShufflePositions.length > cardsInDeck) {
        randomOffsets.current = randomOffsets.current.filter((_, i) => i !== randomOffsets.current.length - 1);
        newShufflePositions = newShufflePositions.filter((_, i) => i !== newShufflePositions.length - 1);
    }

    if (newShufflePositions.length !== shufflePositions.length) {
        setShufflePositions(newShufflePositions)
    }

    // Imploding kitten tracker
    let distanceToImplosion = useColyseusState(state => state.distanceToImplosion);
    let implosionVisible = useColyseusState(state => state.implosionVisible);
    if (!implosionVisible) distanceToImplosion = -1;

    let implosionIndex: number | undefined = undefined;
    if (distanceToImplosion != undefined) implosionIndex = (cardsInDeck - 1) - distanceToImplosion;

    console.log("[ExplodingKittensDebug] imp idx", distanceToImplosion);

    let room = useColyseusRoom();
    useEffect(() => {
        if (room) {
            room.onMessage("shuffled", () => {
                shuffle();
            });
        }
    }, []);

    if (!cardsInDeck) return <div className="relative flex flex-col place-items-center h-60 w-60"/>;

    return (
        <div className={"md:h-52 md:w-56 h-40 w-40 p-12"} onMouseOver={() => {
            if (cardsInDeck < fanLimit) {
                setAngleX(fanAngleX);
                setAngleZOffset(fanAngleZOffset);
            }
        }} onMouseOut={() => {
            if (cardsInDeck < fanLimit) {
                setAngleX(initialAngleX);
                setAngleZOffset(0);
            }
        }}>
            {new Array(cardsInDeck - 1).fill(0).map((_, i) => (
                <CardComponent card={i === implosionIndex ? Card.IMPLODING : Card.BACK} showTooltips={false} style={{
                    transform: `rotate3d(1,0,0,${angleX}deg) 
                                    rotate3d(0,0,1,${angleZ + i * angleZOffset}deg)
                                    translate3d(${randomOffsets.current[i].join("px, ")}px, 0)
                                    translate3d(${newShufflePositions[i].join("px, ")}px, ${i * cardSeparation}px)`,
                    perspective: "1000px"
                }} className={"absolute transition-transform"} key={i}/>
            ))}

            {/* Render top card separately */}
            <CardComponent card={distanceToImplosion === 0 ? Card.IMPLODING : Card.BACK} showTooltips={false}
                           style={{
                               transform: `rotate3d(1,0,0,${drawing ? 0 : angleX}deg) 
                                   rotate3d(0,0,1,${drawing ? 0 : angleZ + (cardsInDeck - 1) * angleZOffset}deg) 
                                   translate3d(${newShufflePositions[cardsInDeck - 1][0]}px, ${newShufflePositions[cardsInDeck - 1][1]}px, ${(cardsInDeck - 1) * cardSeparation}px)
                                   translate3d(${topCardTranslate.join("px, ")}px)`,
                               perspective: "1000px"
                           }}
                           className={"absolute " + (suspendTransition ? "" : "transition-transform ") + (drawDisabled ? "" : "cursor-pointer")}
                           onMouseOver={() => {
                               if (!drawDisabled && !drawing) setTopCardTranslate([0, 0, topCardHoverZ])
                           }}
                           onMouseOut={() => {
                               if (!drawing) setTopCardTranslate([0, 0, 0])
                           }}

                           onClick={() => {
                               if (drawDisabled) return;

                               setDrawing(true);
                               setTopCardTranslate([0, 0, 0]);

                               setTimeout(() => {
                                   setTopCardTranslate([0, window.innerHeight * 0.8, 0]);
                               }, 300)

                               setTimeout(() => {
                                   setSuspendTransition(true); // Suspend transitions while the card is actually drawn
                                   drawCallback();
                               }, 700)
                           }}
            />
        </div>
    )

    function shuffle() {
        if (!cardsInDeck) return;

        setAngleX(0);
        setAngleZ(0);

        randomOffsets.current = new Array(cardsInDeck).fill(0).map(_ => [(Math.random() - 0.5) * randomOffsetFactor, (Math.random() - 0.5) * randomOffsetFactor]);


        for (let i = 0; i < cardsInDeck; i++) {
            setTimeout(() => {
                setShufflePositions(current => current.map((pos, idx) => idx !== i ? pos : [(Math.random() - 0.5) * (0.6 * window.innerWidth), (Math.random() - 0.5) * (0.8 * window.innerHeight)]))
            }, 200 + i * 10)

            setTimeout(() => {
                setShufflePositions(current => current.map((pos, idx) => idx !== i ? pos : [(Math.random() - 0.5) * (0.6 * window.innerWidth), (Math.random() - 0.5) * (0.6 * window.innerHeight)]))
            }, 500 + i * 10)

            setTimeout(() => {
                setShufflePositions(current => current.map((pos, idx) => idx !== i ? pos : [(Math.random() - 0.5) * (0.6 * window.innerWidth), (Math.random() - 0.5) * (0.6 * window.innerHeight)]))
            }, 800 + i * 10)

            setTimeout(() => {
                setShufflePositions(current => current.map((pos, idx) => idx !== i ? pos : [0, 0]));
            }, 1000 + (i * 10))
        }

        setTimeout(() => {
            setAngleX(initialAngleX);
            setAngleZ(initialAngleZ)
        }, 1200 + cardsInDeck * 10)
    }
}

