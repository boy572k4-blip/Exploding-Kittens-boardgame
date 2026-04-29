import {Card} from "../../../../server/shared/card";
import {
    horizontalListSortingStrategy,
    SortableContext,
} from "@dnd-kit/sortable";
import SortableCard from "./SortableCard";
import {Dispatch, SetStateAction, useEffect, useState} from "react";
import {DragEndEvent, DragStartEvent, useDndMonitor} from "@dnd-kit/core";

/**
 * Renders the player's "hand" of cards. Cards are sortable and selectable
 *
 * @param cards What cards are in the hand (internal indices apply to this list)
 * @param selectedCardMask Boolean mask of which cards are selected (internal index)
 * @param setSelectedCardMask Setter for selectedCardMask
 * @param cardOrder Integer list mapping visual indices to internal indices
 * @param activeId Which card is currently active (being dragged)
 * @param isPlayAllowed Whether playing the given card/combo is currently allowed
 * @constructor
 */
export default function CardHand({cards, selectedCardMask, setSelectedCardMask, cardOrder, activeId, isPlayAllowed}: {
    cards: Card[];
    selectedCardMask: boolean[],
    setSelectedCardMask: Dispatch<SetStateAction<boolean[]>>,
    cardOrder: number[],
    activeId: number | undefined,
    isPlayAllowed: boolean
}) {
    let [prevMasked, setPrevMasked] = useState<boolean>(false);
    useDndMonitor({
        onDragStart(event: DragStartEvent) {
            setPrevMasked(selectedCardMask[event.active.id as number - 1])
            setSelectedCardMask(mask => mask.with(event.active.id as number - 1, true));
        },
        onDragEnd(event: DragEndEvent) {
            if (event.over?.id === "discard-pile" && isPlayAllowed) return;
            setSelectedCardMask(mask => mask.with(event.active.id as number - 1, prevMasked));
        }
    })

    // Dynamic margin between cards to bunch them up and prevent them going offscreen
    let [handSizeMargin, setHandSizeMargin] = useState(1);

    const handleResize = () => {
        if (cards.length * 144 > 0.8 * window.innerWidth) {
            let excess = 0.8 * window.innerWidth - cards.length * 144;
            let gaps = cards.length - 1;
            let removePerGap = excess / gaps;
            setHandSizeMargin(removePerGap / 2);
        } else {
            setHandSizeMargin(1);
        }
    }

    useEffect(() => {
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        }
    }, [cards]); // Handler needs to be set up for the current number of cards

    let [prevLength, setPrevLength] = useState(0);
    if (prevLength !== cards.length) {
        setPrevLength(cards.length);
        handleResize();
    }

    return (
        <div className={"flex flex-row justify-center"}>
            <SortableContext
                items={cardOrder.map(e => e + 1)} // ids cannot be 0, so are shifted by 1
                strategy={horizontalListSortingStrategy}
            >
                {cardOrder.map((internIndex) => (
                    <SortableCard key={internIndex} card={cards[internIndex]} id={internIndex + 1} // ids cannot be 0, so are shifted by 1
                                  onclick={() => {
                                      let newSelectedCardMask = structuredClone(selectedCardMask);
                                      newSelectedCardMask[internIndex] = !selectedCardMask[internIndex];
                                      setSelectedCardMask(newSelectedCardMask);
                                  }}
                                  className={"transition-transform " + ((activeId !== internIndex ? selectedCardMask[internIndex] : prevMasked) ? "-translate-y-3" : "") + " " + (activeId === internIndex ? "opacity-30 z-10" : "")}
                                  style={{
                                      marginLeft: handSizeMargin,
                                      marginRight: handSizeMargin,
                                  }}
                    />
                ))}
            </SortableContext>
        </div>
    )
}