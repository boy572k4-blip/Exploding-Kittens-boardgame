import CardComponent from "../cards/CardComponent";
import {Card} from "../../../../server/shared/card";

/**
 * Displays an opponent's hand with 3D card fan effect
 */
export default function OpponentHand({
    playerName,
    numCards,
    position,
    offset = 0,
    isCurrentTurn = false
}: {
    playerName: string;
    numCards: number;
    position: 'top' | 'left' | 'right';
    offset?: number;
    isCurrentTurn?: boolean;
}) {
    // Calculate card positions in a fan
    const maxCards = 10;
    const displayCards = Math.min(numCards, maxCards);
    const angleSpread = 30; // degrees
    const cardSpacing = angleSpread / Math.max(displayCards - 1, 1);

    const getCardStyle = (index: number) => {
        const centerIndex = (displayCards - 1) / 2;
        const angle = (index - centerIndex) * cardSpacing;
        const translateY = Math.abs(index - centerIndex) * 5;
        
        return {
            transform: `
                rotate(${angle}deg)
                translateY(${translateY}px)
                translateZ(${index * 2}px)
            `,
            zIndex: index,
        };
    };

    // Apply offset based on position
    const getContainerStyle = () => {
        if (position === 'top') {
            return {
                left: `calc(50% + ${offset}px)`,
                transform: 'translateX(-50%)'
            };
        } else if (position === 'left') {
            return {
                top: `calc(50% + ${offset}px)`,
                transform: 'translateY(-50%)'
            };
        } else { // right
            return {
                top: `calc(50% + ${offset}px)`,
                transform: 'translateY(-50%)'
            };
        }
    };

    const getCardsRotation = () => {
        if (position === 'left') return 'rotate(-90deg)';
        if (position === 'right') return 'rotate(90deg)';
        return '';
    };

    const containerBaseClass = {
        top: "absolute top-4",
        left: "absolute left-4",
        right: "absolute right-4"
    }[position];

    // Calculate badge position separately (not affected by card rotation)
    const getBadgeStyle = () => {
        if (position === 'top') {
            return {
                position: 'absolute' as const,
                top: '-60px',
                left: `calc(50% + ${offset}px)`,
                transform: 'translateX(-50%)',
                zIndex: 100
            };
        } else if (position === 'left') {
            return {
                position: 'absolute' as const,
                top: `calc(50% + ${offset}px)`,
                left: '-120px',
                transform: 'translateY(-50%)',
                zIndex: 100
            };
        } else { // right
            return {
                position: 'absolute' as const,
                top: `calc(50% + ${offset}px)`,
                right: '-120px',
                transform: 'translateY(-50%)',
                zIndex: 100
            };
        }
    };

    return (
        <>
            {/* Player name badge - separate from cards, always visible */}
            <div 
                className={`whitespace-nowrap transition-all ${
                    isCurrentTurn 
                        ? 'bg-yellow-500 text-black border-yellow-300 animate-pulse scale-110' 
                        : 'bg-gray-800 text-white border-gray-600'
                } px-4 py-2 rounded-lg shadow-lg border-2`}
                style={getBadgeStyle()}
            >
                <div className="font-bold">{playerName}</div>
                <div className={`text-sm ${isCurrentTurn ? 'text-gray-800' : 'text-gray-300'}`}>
                    {numCards} lá bài
                </div>
                {isCurrentTurn && (
                    <div className="text-xs font-bold mt-1">🎯 ĐANG CHƠI</div>
                )}
            </div>

            {/* Cards container */}
            <div className={containerBaseClass} style={getContainerStyle()}>
                <div className="relative">
                    {/* Card fan - rotated for left/right positions */}
                    <div className="relative" style={{
                        perspective: '1000px',
                        transformStyle: 'preserve-3d',
                        width: '200px',
                        height: '140px',
                        transform: getCardsRotation()
                    }}>
                        {Array.from({length: displayCards}, (_, i) => (
                            <div
                                key={i}
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-300"
                                style={getCardStyle(i)}
                            >
                                <div className="scale-75">
                                    <CardComponent card={Card.BACK} showTooltips={false} />
                                </div>
                            </div>
                        ))}
                        
                        {/* Show "+X" if more than maxCards */}
                        {numCards > maxCards && (
                            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-bold">
                                +{numCards - maxCards}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
