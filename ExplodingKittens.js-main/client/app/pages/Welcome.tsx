import {useState} from "react";

const AVATARS = [
    { id: 'king', name: 'Vua', emoji: '👑' },
    { id: 'queen', name: 'Hoàng hậu', emoji: '👸' },
    { id: 'knight', name: 'Cận vệ', emoji: '🤴' },
    { id: 'prince', name: 'Hoàng tử', emoji: '🤴🏻' },
    { id: 'princess', name: 'Công chúa', emoji: '👰' },
    { id: 'wizard', name: 'Phù thủy', emoji: '🧙' },
    { id: 'ninja', name: 'Ninja', emoji: '🥷' },
    { id: 'pirate', name: 'Hải tặc', emoji: '🏴‍☠️' },
];

export default function Welcome({onJoin, defaultRoomId = ''}: {
    onJoin: (playerName: string, roomId: string, avatar: string) => void,
    defaultRoomId?: string
}) {
    const [playerName, setPlayerName] = useState('');
    const [roomId, setRoomId] = useState(defaultRoomId);
    const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0].id);
    const [mode, setMode] = useState<'menu' | 'create' | 'join'>(defaultRoomId ? 'join' : 'menu');

    const handleSubmit = () => {
        if (!playerName.trim()) {
            alert('Vui lòng nhập tên!');
            return;
        }

        if (mode === 'join' && !roomId.trim()) {
            alert('Vui lòng nhập mã phòng!');
            return;
        }

        const finalRoomId = mode === 'create' ? `room_${Date.now()}` : roomId;
        onJoin(playerName, finalRoomId, selectedAvatar);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-purple-900 to-blue-800"></div>
            
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden">
                {Array.from({length: 20}).map((_, i) => (
                    <div
                        key={i}
                        className="absolute animate-float"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 5}s`,
                            animationDuration: `${5 + Math.random() * 10}s`
                        }}
                    >
                        {['🎴', '🃏', '🎯', '⭐', '💫'][Math.floor(Math.random() * 5)]}
                    </div>
                ))}
            </div>

            {/* Main card */}
            <div className="relative z-10 w-full max-w-2xl">
                <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-3xl shadow-2xl border-4 border-yellow-600/50 p-8">
                    {/* Logo/Title */}
                    <div className="text-center mb-8">
                        <h1 className="text-5xl font-bold text-yellow-400 mb-2 drop-shadow-lg">
                            🐱💣 Exploding Kittens
                        </h1>
                        <p className="text-gray-300 text-lg">Trò chơi mèo nổ siêu hấp dẫn!</p>
                    </div>

                    {mode === 'menu' ? (
                        /* Main Menu */
                        <div className="space-y-4">
                            <button
                                onClick={() => setMode('create')}
                                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold py-4 px-6 rounded-xl text-xl transition-all transform hover:scale-105 hover:shadow-xl flex items-center justify-center gap-3"
                            >
                                <span className="text-2xl">🏠</span>
                                Tạo phòng mới
                            </button>
                            
                            <button
                                onClick={() => setMode('join')}
                                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-xl text-xl transition-all transform hover:scale-105 hover:shadow-xl flex items-center justify-center gap-3"
                            >
                                <span className="text-2xl">🚪</span>
                                Vào phòng
                            </button>
                        </div>
                    ) : (
                        /* Create/Join Form */
                        <div className="space-y-6">
                            {/* Player Name Input */}
                            <div>
                                <label className="block text-yellow-400 font-bold mb-2 text-lg">
                                    Tên của bạn:
                                </label>
                                <input
                                    type="text"
                                    value={playerName}
                                    onChange={(e) => setPlayerName(e.target.value)}
                                    placeholder="Nhập tên..."
                                    maxLength={20}
                                    className="w-full bg-gray-800/80 text-white border-2 border-gray-600 rounded-xl px-4 py-3 text-lg focus:border-yellow-500 focus:outline-none transition-colors"
                                />
                            </div>

                            {/* Avatar Selection */}
                            <div>
                                <label className="block text-yellow-400 font-bold mb-3 text-lg">
                                    Chọn nhân vật:
                                </label>
                                <div className="grid grid-cols-4 gap-3">
                                    {AVATARS.map((avatar) => (
                                        <button
                                            key={avatar.id}
                                            onClick={() => setSelectedAvatar(avatar.id)}
                                            className={`relative bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl p-4 transition-all transform hover:scale-105 border-4 ${
                                                selectedAvatar === avatar.id
                                                    ? 'border-yellow-500 shadow-lg shadow-yellow-500/50'
                                                    : 'border-gray-600 hover:border-gray-500'
                                            }`}
                                        >
                                            <div className="text-4xl mb-2">{avatar.emoji}</div>
                                            <div className="text-xs text-gray-300 font-semibold">{avatar.name}</div>
                                            {selectedAvatar === avatar.id && (
                                                <div className="absolute -top-2 -right-2 bg-green-500 rounded-full w-6 h-6 flex items-center justify-center">
                                                    ✓
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Room ID Input (only for join mode) */}
                            {mode === 'join' && (
                                <div>
                                    <label className="block text-yellow-400 font-bold mb-2 text-lg">
                                        Mã phòng:
                                    </label>
                                    <input
                                        type="text"
                                        value={roomId}
                                        onChange={(e) => setRoomId(e.target.value)}
                                        placeholder="Nhập mã phòng..."
                                        className="w-full bg-gray-800/80 text-white border-2 border-gray-600 rounded-xl px-4 py-3 text-lg focus:border-yellow-500 focus:outline-none transition-colors uppercase"
                                    />
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setMode('menu')}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl transition-all"
                                >
                                    ← Quay lại
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white font-bold py-3 px-6 rounded-xl transition-all transform hover:scale-105 hover:shadow-xl"
                                >
                                    {mode === 'create' ? '🏠 Tạo phòng' : '🚪 Vào phòng'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="text-center mt-6 text-gray-400 text-sm">
                    <p>💡 Mẹo: Chia sẻ mã phòng với bạn bè để chơi cùng!</p>
                </div>
            </div>

            <style>{`
                @keyframes float {
                    0%, 100% {
                        transform: translateY(0) rotate(0deg);
                        opacity: 0.3;
                    }
                    50% {
                        transform: translateY(-20px) rotate(180deg);
                        opacity: 0.6;
                    }
                }
                .animate-float {
                    animation: float linear infinite;
                }
            `}</style>
        </div>
    );
}
