import { useEffect, useState } from 'react';

interface EmojiAnimationProps {
    emoji: string;
    playerName: string;
    position: { x: number; y: number };
    onComplete: () => void;
}

export default function EmojiAnimation({ emoji, playerName, position, onComplete }: EmojiAnimationProps) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Animation duration
        const timer = setTimeout(() => {
            setIsVisible(false);
            onComplete();
        }, 3000);

        return () => clearTimeout(timer);
    }, [onComplete]);

    if (!isVisible) return null;

    return (
        <div
            className="fixed pointer-events-none z-50 animate-emoji-float"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
            }}
        >
            {/* Emoji */}
            <div className="text-6xl animate-bounce-slow">
                {emoji}
            </div>
            {/* Player name */}
            <div className="text-white text-sm font-bold bg-black/70 px-3 py-1 rounded-full mt-2 text-center whitespace-nowrap">
                {playerName}
            </div>
        </div>
    );
}
