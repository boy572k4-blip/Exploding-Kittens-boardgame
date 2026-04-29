import {Card, CardNames} from "../../../../server/shared/card";
import CardComponent from "../cards/CardComponent";
import {LocalStorageContext} from "../../utility/contexts";
import {useContext} from "react";

/**
 * Displays the modal contents listing all cards so one can be picked
 *
 * @param callback Function to call with the selected card
 * @constructor
 */
export default function TargetCard({callback}: { callback: (cardId: Card) => void }) {
    const showTooltips = useContext(LocalStorageContext).showTooltips;

    return (
        <div className="flex flex-row gap-1 flex-wrap justify-center">
            {Array.from(CardNames.keys()).filter(card => ![Card.BACK, Card.EXPLODING].includes(card)).map(cardId =>
                <div key={cardId}>
                    <button onClick={() => callback(cardId)}><CardComponent card={cardId} showTooltips={showTooltips}/></button>
                </div>
                )}
        </div>
    );
}