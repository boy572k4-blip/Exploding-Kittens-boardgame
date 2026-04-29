import {Card} from "../../../../server/shared/card";
import CardComponent from "./CardComponent";
import {DragOverEvent, useDndMonitor} from "@dnd-kit/core";
import {useState} from "react";
import {cardSeparation, fanAngleZOffset, initialAngleX, initialAngleZ} from "../../utility/constants";

/**
 * Hovering card visual overlay to be dragged around
 *
 * @param card The type of card being dragged
 * @param selectedCards All selected cards to be rendered over the drop zone
 * @param isPlayAllowed Whether playing the given card/combo is currently allowed
 */
export default function DroppableCard({card, selectedCards, isPlayAllowed}: { card: Card, selectedCards: Card[], isPlayAllowed: boolean }) {
    const [overDiscardPile, setOverDiscardPile] = useState(false);

    useDndMonitor({
        onDragOver(event: DragOverEvent) {
            if (!event.over) return;
            if (event.over.id == 'discard-pile') {
                setOverDiscardPile(true);
            } else {
                setOverDiscardPile(false);
            }
        },
        onDragEnd() {
            setOverDiscardPile(false);
        }
    })

    return (
        <div
            className={"md:min-w-36 md:min-h-[200px] min-w-24 min-h-[130px]"}> {/* Ensure the overlay still has dimensions when the cards are transformed and absolutely positioned */}
            {
                selectedCards.filter((_, i) => i != selectedCards.indexOf(card)).map((selectedCard, i) => (
                    <CardComponent card={selectedCard} showTooltips={false} key={i} style={{
                        transform: `
                            rotate3d(1,0,0,${initialAngleX}deg)
                            rotate3d(0,0,1,${initialAngleZ + i * fanAngleZOffset}deg)
                            translateZ(${i * cardSeparation}px)`
                    }} className={"transition-transform absolute " + (overDiscardPile && isPlayAllowed ? "" : "hidden")}/>
                ))
            }
            <CardComponent showTooltips={false} card={card} key={selectedCards.length - 1} style={{
                transform: overDiscardPile && isPlayAllowed ? `
                            rotate3d(1,0,0,${initialAngleX}deg)
                            rotate3d(0,0,1,${initialAngleZ + (selectedCards.length - 1) * fanAngleZOffset}deg)
                            translateZ(${(selectedCards.length - 1) * cardSeparation}px)` : ""
            }} className={"transition-transform absolute delay-0"}/>
        </div>
    )
}