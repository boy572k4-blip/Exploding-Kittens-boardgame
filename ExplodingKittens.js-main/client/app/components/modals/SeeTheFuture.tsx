import {Card} from "../../../../server/shared/card";
import {useState} from "react";
import {
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    horizontalListSortingStrategy,
    SortableContext,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import SortableCard from "../cards/SortableCard";
import {useColyseusRoom, useColyseusState} from "../../utility/contexts";
import {TurnState} from "../../../../server/shared/util";

/**
 * Displays the modal contents showing the future, optionally allowing it to be edited using sortables.
 *
 * @param theFuture What cards are in the future
 * @param callback Function to call when viewing or choosing is done.
 * @constructor
 */
export default function SeeTheFuture({theFuture, callback}: { theFuture: Card[], callback: () => void }) {
    let room = useColyseusRoom();
    let turnState = useColyseusState(state => state.turnState);

    let alter = turnState === TurnState.AlteringTheFuture;

    let [indices, setIndices] = useState([0, 1, 2]);
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
        useSensor(TouchSensor)
    );

    function handleDragEnd(event: DragEndEvent) {
        const {active, over} = event;
        if (!over) return;

        if (active.id !== over.id) {
            setIndices((indices) => {
                const oldIndex = indices.indexOf(active.id as number - 1);
                const newIndex = indices.indexOf(over.id as number - 1);

                return arrayMove(indices, oldIndex, newIndex);
            });
        }
    }

    return (
        <>
            <div className={"flex flex-row"}>
                <DndContext
                    sensors={sensors}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={indices}
                        strategy={horizontalListSortingStrategy}
                        disabled={!alter}
                    >
                        {indices.map((index) => (
                            <SortableCard key={index} card={theFuture[index]} id={index + 1}/>
                        ))}
                    </SortableContext>
                </DndContext>
            </div>

            <button onClick={() => {
                if (alter && room) {
                    room.send("alterTheFuture", {cards: indices.map(index => theFuture[index])})
                }
                callback();
            }}>OK!
            </button>
        </>
    )
}