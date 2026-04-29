import {useEffect, useState} from "react";
import {useColyseusRoom, useColyseusState} from "../../utility/contexts";
import {CardNames} from "../../../../server/shared/card";
import {TurnState} from "../../../../server/shared/util";

/**
 * Displays information about targeted cards that have been played
 *
 * @constructor
 */
export default function TargetInfobox() {
    let [message, setMessage] = useState('');
    let [hidden, setHidden] = useState(true);

    let room = useColyseusRoom();
    let players = useColyseusState(state => state.players);

    useEffect(() => {
        if (!room || !players) return () => {};

        room.onMessage("cardTarget", message => {
            setHidden(false);
            setMessage(`Targeted at ${players.toArray()[message.target].displayName}!`);
        });

        room.onMessage("comboTarget", message => {
            setHidden(false);
            switch (message.numCards) {
                case 2:
                    setMessage(`Targeted at ${players.toArray()[message.target].displayName}!`);
                    break;
                case 3:
                    setMessage(`Targeted at ${players.toArray()[message.target].displayName}, for ${CardNames.get(message.targetCard)}`);
                    break;
                case 5:
                    setMessage(`Looking for ${CardNames.get(message.targetCard)}!`);
            }
        });

        const removeListener = room.state.listen("turnState", value => {
            if (value == TurnState.Normal) {
                setHidden(true);
            }
        });

        return () => {removeListener()}
    }, [room]);

    return (
        <div className={"w-36 absolute top-4 bg-red-800 rounded-lg transition-opacity " + (hidden ? "opacity-0" : "opacity-100")}>
            <p>{message}</p>
        </div>
    )
}