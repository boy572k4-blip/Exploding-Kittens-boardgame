import Deck from "../components/game/Deck";
import {TurnState} from "../../../server/shared/util";
import Discard from "../components/game/Discard";
import {useColyseusRoom, useColyseusState} from "../utility/contexts";
import {DndContext} from "@dnd-kit/core";

export default function Spectate() {
    let room = useColyseusRoom();
    if (room == undefined) return;

    let turnState = useColyseusState(state => state.turnState);
    let turnIndex = useColyseusState(state => state.turnIndex);
    if (turnIndex === undefined) return;

    let playerIndexMap = useColyseusState(state => state.playerIndexMap)
    if (playerIndexMap == undefined) return;

    let players = useColyseusState(state => state.players);
    if (players == undefined) return;

    let spectators = useColyseusState(state => state.spectators);
    if (spectators == undefined) return;

    let turnRepeats = useColyseusState(state => state.turnRepeats);

    return (
        <DndContext>
            {/* Mini player */}
            <div className="h-full sm:hidden flex flex-col justify-center text-center p-6 align-middle">
                <div className={"border rounded-md p-4 backdrop-blur w-fit m-auto"}>
                    <p>Người chơi: {players.map(player => `${player.displayName} (${player.numCards} lá bài)`).join(", ")}</p>
                    {spectators.length > 0 ?
                        <p>Người xem: {spectators.map(player => player.displayName).join(", ")}</p> : null}

                    <p>{"Lượt của " + (players.at(turnIndex)?.displayName ?? 'Unknown') + " x" + turnRepeats}</p>
                </div>
            </div>
            <div className={"items-center text-center justify-center h-full hidden sm:flex"}>
                <div className={"flex flex-col"}>
                    <div className={"border rounded-md p-4 backdrop-blur backdrop-brightness-50 w-fit m-auto"}>
                        <p>Người chơi: {players.map(player => `${player.displayName} (${player.numCards} lá bài)`).join(", ")}</p>
                        {spectators.length > 0 ?
                            <p>Người xem: {spectators.map(player => player.displayName).join(", ")}</p> : null}

                        <p>{"Lượt của " + (players.at(turnIndex)?.displayName ?? 'Unknown') + " x" + turnRepeats}</p>
                    </div>

                    <div className={"flex flex-row justify-center md:gap-20 gap-10"}>
                        <Deck drawCallback={() => room.send("drawCard")}
                              drawDisabled={turnState !== TurnState.Normal || playerIndexMap.get(room.sessionId) !== turnIndex}/>

                        <Discard/>
                    </div>
                </div>
            </div>
        </DndContext>
    )
}
