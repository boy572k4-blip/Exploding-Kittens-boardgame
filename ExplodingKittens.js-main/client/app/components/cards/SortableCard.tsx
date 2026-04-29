import {Card} from "../../../../server/shared/card";
import {useSortable} from "@dnd-kit/sortable";
import {CSS} from '@dnd-kit/utilities';
import {HTMLAttributes, useContext} from "react";
import CardComponent from "./CardComponent";
import {LocalStorageContext} from "../../utility/contexts";

/**
 * A card in a list with the capability to be dragged and dropped to sort.
 *
 * @param card The type of card
 * @param id Unique id passed to the drag handler
 * @param onclick Callback when the card is clicked
 * @param props All other props
 * @constructor
 */
export default function SortableCard({card, id, onclick, ...props}: {
    card: Card,
    id: number
    onclick?: () => void
} & Omit<HTMLAttributes<HTMLDivElement>, "id">) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition
    } = useSortable({id: id});

    const showTooltips = useContext(LocalStorageContext).showTooltips;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    };

    return (
        <div {...props}>
            <CardComponent ref={setNodeRef} style={style} card={card} showTooltips={showTooltips} showInfoButton={true} {...attributes} {...listeners} onClick={onclick}/>
        </div>
    );
}