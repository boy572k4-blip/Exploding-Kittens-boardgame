import CardComponent from "../cards/CardComponent";
import {Card} from "../../../../server/shared/card";
import {useRef, useState} from "react";
import {useColyseusRoom, useColyseusState} from "../../utility/contexts";
import {cardSeparation, deckSplitHoverZ, initialAngleX, initialAngleZ, randomOffsetFactor} from "../../utility/constants";
import {TurnState} from "../../../../server/shared/util";

/**
 * Displays a deck that can be split using the mouse to choose a position. Sends the message to colyseus as well.
 *
 * @param doneCallback Function to call when choosing is done
 * @constructor
 */
export default function ChoosePositionDeck({doneCallback}: { doneCallback: () => void }) {
    let cardsInDeck = useColyseusState(state => state.deckLength) ?? 0;

    let randomOffsets = useRef(new Array(cardsInDeck + 1).fill(0).map(_ => [(Math.random() - 0.5) * randomOffsetFactor, (Math.random() - 0.5) * randomOffsetFactor]));

    let distanceToImplosion = useColyseusState(state => state.distanceToImplosion);
    let implosionVisible = useColyseusState(state => state.implosionVisible);
    if (!implosionVisible) distanceToImplosion = -1;

    let implosionIndex: number | undefined = undefined;
    if (distanceToImplosion != undefined) implosionIndex = (cardsInDeck - 1) - distanceToImplosion;

    let [hoveredCardIndices, setHoveredCardIndices] = useState<number[]>([]);
    const theCard = hoveredCardIndices.reduce((a, b) => Math.max(a, b), 0);

    let turnState = useColyseusState(state => state.turnState);

    let room = useColyseusRoom();

    return (
        <div className={"h-60 w-60 p-12"} onClick={() => {
            room?.send("choosePosition", {index: cardsInDeck - theCard});
            doneCallback()
        }}>
            {new Array(cardsInDeck + 1).fill(0).map((_, i) => (
                <CardComponent card={(i === implosionIndex && distanceToImplosion !== -1) ||
                (turnState == TurnState.ChoosingImplodingPosition && i == theCard)
                    ? Card.IMPLODING : Card.BACK} showTooltips={false} style={{
                    transform: `rotate3d(1,0,0,${initialAngleX}deg) 
                                    rotate3d(0,0,1,${initialAngleZ}deg)
                                    translate3d(${randomOffsets.current[i].join("px, ")}px, 0)
                                    translateZ(${(i * cardSeparation) + (i > theCard ? deckSplitHoverZ : (i < theCard ? -deckSplitHoverZ : 0))}px)`,
                    perspective: "1000px"
                }} className={"absolute transition-transform"} key={i}
                               onMouseOver={() => {
                                   setHoveredCardIndices(prevState => prevState.concat(i))
                               }} onMouseOut={() => {
                    setHoveredCardIndices(prevState => prevState.filter(e => e != i))
                }}/>
            ))}
        </div>
    )
}

