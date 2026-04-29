import React from "react";
import ChoosePositionDeck from "./ChoosePositionDeck";

/**
 * Displays the modal contents to choose the position of an exploding or imploding kitten in the deck
 *
 * @param callback Function to call when choosing is done
 * @constructor
 */
export default function ChoosePosition({callback}: { callback: () => void }) {
    return (
        <div className={"w-full h-full flex justify-center align-middle"}>
            <ChoosePositionDeck doneCallback={callback}/>
        </div>
    )
}