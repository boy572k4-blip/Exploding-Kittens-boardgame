import Lobby from "./Lobby";
import Game from "./Game";
import {LocalStorageContext, LocalStorageContextType, useColyseusRoom, useColyseusState} from "../utility/contexts";
import Spectate from "./Spectate";
import {useEffect, useState} from "react";

export default function App() {
    const started = useColyseusState((state) => state.started);

    let room = useColyseusRoom();
    let playerIndexMap = useColyseusState(state => state.playerIndexMap) ?? new Map();
    let ourIndex = room ? playerIndexMap.get(room.sessionId) ?? -1 : -1;

    const spectating = ourIndex === -1;

    const [showTooltips, setShowTooltips] = useState(() => {
        const storageShow = localStorage.getItem('showTooltips');
        return storageShow ? !!parseInt(storageShow) : true;
    });

    useEffect(() => {
        localStorage.setItem('showTooltips', String(+showTooltips));
    }, [showTooltips]);

    const localStorageContext = new LocalStorageContextType(showTooltips, setShowTooltips);

    // Wait for room to be ready before rendering
    if (!room) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-white text-xl">Đang kết nối...</p>
            </div>
        );
    }

    return (
        <LocalStorageContext.Provider value={localStorageContext}>
            <img src={"/background.png?url"} alt={"background image"} className={"absolute -z-40 h-full w-full object-cover"}/>
            {started ?
                (spectating ?
                        <Spectate/>
                        :
                        <Game/>
                )
                : // Use lobby if either no connection has been made or the game is not started
                <Lobby/>
            }
        </LocalStorageContext.Provider>
    )
}