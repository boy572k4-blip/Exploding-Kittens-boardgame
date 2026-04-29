import {useColyseusRoom, useColyseusState} from "../utility/contexts";
import PlayerList from "../components/lobby/PlayerList";
import SettingsList from "../components/lobby/SettingsList";
import {useEffect, useRef, useState} from "react";

export default function Lobby() {
    let room = useColyseusRoom();
    let ownerId = useColyseusState((state) => state.ownerId);

    let [enoughPlayers, setEnoughPlayers] = useState(false);
    let [showCopied, setShowCopied] = useState(false);

    let numPlayers = useRef(0);

    // Get room ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room') || 'unknown';

    const copyRoomId = () => {
        const fullUrl = window.location.href;
        navigator.clipboard.writeText(fullUrl).then(() => {
            setShowCopied(true);
            setTimeout(() => setShowCopied(false), 2000);
        });
    };

    useEffect(() => {
        room?.state.spectators.onAdd(() => {
            numPlayers.current++;
            if (numPlayers.current > 1) setEnoughPlayers(true);
        });

        room?.state.spectators.onRemove(() => {
            numPlayers.current--;
            if (numPlayers.current < 2) setEnoughPlayers(false);
        });
    }, []);

    let isOwner = room?.sessionId === ownerId;
    let titleText = enoughPlayers ? (isOwner ? 'Start the game!' : 'Only the game owner may start the game.') : 'You are friendless.';

    let [mousePos, setMousePos] = useState([0, 0]);

    return (
        <>
            <div className={"h-full sm:hidden flex flex-col justify-center text-center p-6 align-middle"}>
                {/* Room ID for mobile */}
                <div className="mb-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-3 shadow-lg">
                    <p className="text-xs text-blue-200 mb-1">Mã phòng:</p>
                    <code className="text-xl font-bold text-white">{roomId}</code>
                    <button
                        onClick={copyRoomId}
                        className="mt-2 bg-white/20 text-white text-sm px-3 py-1 rounded"
                    >
                        {showCopied ? '✓ Đã copy!' : '📋 Copy'}
                    </button>
                </div>
                
                <PlayerList
                    className={"justify-self-end border rounded-md p-4 backdrop-blur backdrop-brightness-50 flex-1"}/>
            </div>
            <div className={"h-full hidden sm:block"}>
                {room ?
                    <div className={"flex flex-col place-items-center p-5 h-full"} onMouseMove={(event) => {
                        setMousePos([event.clientX, event.clientY]);
                    }} onMouseOut={() => {
                        setMousePos([window.innerWidth / 2, window.innerHeight / 2]);
                    }}>
                        {/* Room ID Display */}
                        <div className="w-full max-w-2xl mb-4">
                            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-4 shadow-2xl border-2 border-blue-400">
                                <div className="text-center">
                                    <p className="text-sm text-blue-200 mb-1">Mã phòng của bạn:</p>
                                    <div className="flex items-center justify-center gap-3">
                                        <code className="text-3xl font-bold text-white bg-black/30 px-6 py-2 rounded-lg tracking-wider">
                                            {roomId}
                                        </code>
                                        <button
                                            onClick={copyRoomId}
                                            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-all transform hover:scale-110 flex items-center gap-2"
                                            title="Copy link phòng"
                                        >
                                            {showCopied ? '✓ Đã copy!' : '📋 Copy link'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-blue-200 mt-2">
                                        Chia sẻ link này với bạn bè để họ vào phòng!
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className={"flex flex-row place-items-center h-full w-full"}>
                            <SettingsList
                                className={"justify-self-start border rounded-md p-4 backdrop-blur backdrop-brightness-50 flex-1"}/>
                            <div className={"flex-grow flex flex-col h-full items-center justify-center"}>
                                <img src={"/logotransparent.png?url"} alt={"exploding kittens logo"}
                                     className={"origin-center backdrop-blur backdrop-hue-rotate-180 rounded-full max-h-[70vh]"}
                                     style={{transform: `translate(${(mousePos[0] - 0.5 * window.innerWidth) * 0.02}px, ${(mousePos[1] - 0.5 * window.innerHeight) * 0.01}px)`}}/>
                            </div>
                            <PlayerList
                                className={"justify-self-end border rounded-md p-4 backdrop-blur backdrop-brightness-50 flex-1"}/>
                        </div>
                        <button
                            className={"align-bottom py-1 px-4 font-bold text-2xl bg-red-950 rounded-2xl duration-75 outline outline-2 " + ((isOwner && enoughPlayers) ? "hover:-translate-y-2" : "")}
                            onClick={() => {
                                room.send("start")
                            }} disabled={!isOwner || !enoughPlayers}
                            title={titleText}>Start!
                        </button>
                    </div>
                    :
                    <p className={"text-center mt-[45vh]"}>Joining room...</p>
                }
            </div>
        </>
    )
}