import {useColyseusRoom, useColyseusState} from "../../utility/contexts";

/**
 * Displays the modal contents listing all players so one can be picked
 *
 * @param callback Function to call with the selected player
 * @constructor
 */
export default function TargetPlayer({callback}: {callback: (sessionId: string) => void}) {
    let room = useColyseusRoom();
    let allPlayers = useColyseusState(state => state.players) ?? [];

    let players = allPlayers.filter(player => room && player.sessionId !== room.sessionId);

    return (
        <ul>
            {players.map((player) => (
                <li key={player.sessionId}>
                    <button onClick={() => {callback(player.sessionId)}}>{player.displayName}</button>
                </li>
            ))}
        </ul>
    );
}