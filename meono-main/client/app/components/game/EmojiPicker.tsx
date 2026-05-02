import { useState } from 'react';

interface EmojiPickerProps {
    onEmojiSelect: (emoji: string) => void;
}

const EMOJIS = [
    '😀', '😂', '😍', '😎', '🤔', '😱',
    '😭', '😡', '🤯', '🥳', '😴', '🤪',
    '👍', '👎', '👏', '🙏', '💪', '🔥',
    '❤️', '💔', '⭐', '💯', '🎉', '🎮'
];

export default function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleEmojiClick = (emoji: string) => {
        onEmojiSelect(emoji);
        setIsOpen(false);
    };

    return (
        <div className="fixed bottom-24 right-6 z-50">
            {/* Emoji button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl transition-all hover:scale-110 active:scale-95"
                title="Gửi emoji"
            >
                😊
            </button>

            {/* Emoji popup */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />
                    
                    {/* Emoji grid */}
                    <div className="absolute bottom-16 right-0 bg-gray-900 border-2 border-purple-500 rounded-2xl shadow-2xl p-4 animate-in fade-in zoom-in duration-200">
                        <div className="text-white text-sm font-bold mb-2 text-center">
                            Chọn emoji 😊
                        </div>
                        <div className="grid grid-cols-6 gap-2 max-w-xs">
                            {EMOJIS.map((emoji, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleEmojiClick(emoji)}
                                    className="w-10 h-10 text-2xl hover:bg-purple-600 rounded-lg transition-all hover:scale-125 active:scale-95 flex items-center justify-center"
                                    title={emoji}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
