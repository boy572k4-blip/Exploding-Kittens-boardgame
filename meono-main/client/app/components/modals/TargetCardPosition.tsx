import {useColyseusRoom, useColyseusState} from "../../utility/contexts";
import CardComponent from "../cards/CardComponent";
import {Card} from "../../../../server/shared/card";

/**
 * Modal to select a card position from opponent's hand (for 2-card combo)
 * Shows face-down cards that can be clicked
 */
export default function TargetCardPosition({targetSessionId, callback}: {
    targetSessionId: string,
    callback: (cardIndex: number) => void
}) {
    let room = useColyseusRoom();
    let playerIndexMap = useColyseusState(state => state.playerIndexMap) ?? new Map();
    let players = useColyseusState(state => state.players) ?? [];

    if (!room) return null;

    const targetPlayerIndex = playerIndexMap.get(targetSessionId);
    if (targetPlayerIndex === undefined) return null;

    const targetPlayer = players[targetPlayerIndex];
    if (!targetPlayer) return null;

    const numCards = targetPlayer.numCards;

    return (
        <div className="mt-4">
            <p className="text-white mb-4">
                Chọn 1 lá bài từ tay của <span className="font-bold">{targetPlayer.displayName}</span>:
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
                {Array.from({length: numCards}, (_, index) => (
                    <button
                        key={index}
                        onClick={() => callback(index)}
                        className="transform transition-transform hover:scale-110 hover:-translate-y-2 relative"
                    >
                        <CardComponent card={Card.BACK} showTooltips={false} />
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                            #{index + 1}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
