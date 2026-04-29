import {HTMLAttributes} from "react";
import {useColyseusState} from "../../utility/contexts";

/**
 * Displays a list of players
 *
 * @param props
 * @constructor
 */
export default function PlayerList(props: HTMLAttributes<HTMLDivElement>) {
    const spectators = useColyseusState((state) => state.spectators)

    return (
        <div {...props}>
            <h2 className={"font-bold underline text-center"}>Players in lobby</h2>
            <ol>
                {
                    spectators ?
                        spectators.toArray().map(spectator => (
                            <li key={spectator.sessionId}
                                className={"text-center"}>{spectator.displayName}</li>
                        ))
                        :
                        null
                }
            </ol>
        </div>
    )
}