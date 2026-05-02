import { Container, createRoot } from "react-dom/client";
import App from "./pages/App";
import { setupDiscordSdk } from "./utility/discord_sdk"
import './index.css'

import { DiscordSDK } from "@discord/embedded-app-sdk";
import { client, DiscordSDKContext, DiscordSDKContextType, setCurrentRoom } from "./utility/contexts";
import { GameRoomState } from "../../server/src/rooms/schema/GameRoomState";
import { Room } from "colyseus.js";

import { AuthResponse } from "./utility/discord_sdk"

// Bypass Discord SDK for local/ngrok play
const USE_DISCORD = false;

if (USE_DISCORD) {
    const discordSDK = new DiscordSDK("1248976494152122419");

    console.log("[ExplodingKittens] Discord SDK is authing...")
    setupDiscordSdk(discordSDK).then((receivedAuth: AuthResponse) => {
        console.log("[ExplodingKittens] Discord SDK is authenticated");

        const discordContext = new DiscordSDKContextType();
        discordContext.auth = receivedAuth;
        discordContext.discordSDK = discordSDK;

        const loading = document.getElementById("loading");
        if (loading) loading.style.display = 'none';

        const instanceId = discordSDK.instanceId;
        const joinOptions = {
            displayName: receivedAuth.user.global_name ?? receivedAuth.user.username
        };

        (async () => {
            let room: Room<GameRoomState>;
            console.log(`[ExplodingKittens] Attempting to join game with id ${instanceId}`);

            let availableRooms = await client.getAvailableRooms()
            console.log(`[ExplodingKittens] Available Rooms: ${availableRooms.toString()}`);

            while (true) {
                try {
                    room = await client.joinById<GameRoomState>(instanceId, joinOptions)
                    await setCurrentRoom(room);
                } catch (e) {
                    console.log(`[ExplodingKittens] Failed to join, retrying. ${e}`)
                    if ((e as any).message?.includes("is already full")) continue;

                    console.log(`[ExplodingKittens] Failed to join, creating room. ${e}`)
                    room = await client.create<GameRoomState>("game_room", { instanceId: instanceId, ...joinOptions })
                    await setCurrentRoom(room);
                }
                break;
            }

            addEventListener("unload", () => {
                room.leave(false); // false = allow Colyseus reconnection
            })

            console.log("[ExplodingKittens] Joined room with instance id " + instanceId)
        })().then(() => {
            createRoot(document.getElementById('root') as Container).render(
                <DiscordSDKContext.Provider value={discordContext}>
                    <App />
                </DiscordSDKContext.Provider>
            )
        })

    });
} else {
    // Bypass mode - no Discord SDK
    console.log("[ExplodingKittens] Running in bypass mode (no Discord)");

    const loading = document.getElementById("loading");
    if (loading) loading.style.display = 'none';

    // Check if we have stored player info and room ID in URL (page refresh)
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('room');
    const storedPlayerName = localStorage.getItem('playerName');
    const storedAvatar = localStorage.getItem('playerAvatar');

    // Function to show welcome screen
    const showWelcomeScreen = (prefillRoomId: string = '') => {
        import('./pages/Welcome').then(({ default: Welcome }) => {
            const welcomeRoot = createRoot(document.getElementById('root') as Container);

            welcomeRoot.render(
                <Welcome
                    defaultRoomId={prefillRoomId}
                    onJoin={(playerName: string, roomId: string, avatar: string) => {
                        // Store player info
                        localStorage.setItem('playerName', playerName);
                        localStorage.setItem('playerAvatar', avatar);

                        // Update URL with room ID
                        window.history.pushState({}, '', `?room=${roomId}`);

                        const joinOptions = {
                            displayName: `${avatar} ${playerName}`
                        };

                        (async () => {
                            let room: Room<GameRoomState>;
                            console.log(`[ExplodingKittens] Attempting to join room ${roomId}`);

                            try {
                                room = await client.joinById<GameRoomState>(roomId, joinOptions);
                                console.log(`[ExplodingKittens] Joined existing room ${roomId}`);
                            } catch (e) {
                                console.log(`[ExplodingKittens] Room not found, creating new room ${roomId}`);
                                room = await client.create<GameRoomState>("game_room", { instanceId: roomId, ...joinOptions });
                                console.log(`[ExplodingKittens] Created room ${roomId}`);
                            }

                            // No need to store reconnection tokens - server recognizes by displayName
                            await setCurrentRoom(room);

                            addEventListener("unload", () => {
                                room.leave(false); // false = allow Colyseus reconnection
                            });

                            console.log(`[ExplodingKittens] Connected to room ${roomId}. Share this URL: ${window.location.href}`);

                            // Create fake Discord context for compatibility
                            const discordContext = new DiscordSDKContextType();
                            discordContext.auth = {
                                user: {
                                    id: `user_${Date.now()}`,
                                    username: playerName,
                                    discriminator: '0000',
                                    global_name: playerName,
                                    avatar: null,
                                    public_flags: 0
                                },
                                scopes: [],
                                expires: new Date(Date.now() + 86400000).toISOString(),
                                application: {
                                    id: '1248976494152122419',
                                    description: '',
                                    name: 'Exploding Kittens',
                                    icon: null,
                                    rpc_origins: []
                                }
                            } as any;
                            discordContext.discordSDK = {} as any;

                            // Render main app
                            welcomeRoot.render(
                                <DiscordSDKContext.Provider value={discordContext}>
                                    <App />
                                </DiscordSDKContext.Provider>
                            );
                        })();
                    }}
                />
            );
        });
    };

    // Check if we should auto-rejoin (have all required info)
    if (roomIdFromUrl && storedPlayerName && storedAvatar) {
        console.log(`[ExplodingKittens] Attempting to rejoin room ${roomIdFromUrl}`);

        const joinOptions = {
            displayName: `${storedAvatar} ${storedPlayerName}`
        };

        (async () => {
            let room: Room<GameRoomState> | null = null;

            try {
                // Retry joinById a few times to handle server-side reconnection window
                console.log(`[ExplodingKittens] Rejoining room ${roomIdFromUrl} as ${joinOptions.displayName}...`);

                let lastError: any;
                for (let attempt = 1; attempt <= 8; attempt++) {
                    try {
                        room = await client.joinById<GameRoomState>(roomIdFromUrl, joinOptions);
                        console.log(`[ExplodingKittens] Successfully rejoined room on attempt ${attempt}!`);
                        break;
                    } catch (joinError) {
                        lastError = joinError;
                        console.warn(`[ExplodingKittens] Rejoin attempt ${attempt} failed:`, joinError);
                        if (attempt < 8) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                    }
                }

                if (!room) {
                    throw lastError;
                }

                await setCurrentRoom(room);

                const roomRef = room!;
                addEventListener("unload", () => {
                    roomRef.leave(false); // false = allow Colyseus reconnection
                });

                // Create fake Discord context for compatibility
                const discordContext = new DiscordSDKContextType();
                discordContext.auth = {
                    user: {
                        id: `user_${Date.now()}`,
                        username: storedPlayerName,
                        discriminator: '0000',
                        global_name: storedPlayerName,
                        avatar: null,
                        public_flags: 0
                    },
                    scopes: [],
                    expires: new Date(Date.now() + 86400000).toISOString(),
                    application: {
                        id: '1248976494152122419',
                        description: '',
                        name: 'Exploding Kittens',
                        icon: null,
                        rpc_origins: []
                    }
                } as any;
                discordContext.discordSDK = {} as any;

                // Render main app
                createRoot(document.getElementById('root') as Container).render(
                    <DiscordSDKContext.Provider value={discordContext}>
                        <App />
                    </DiscordSDKContext.Provider>
                );
            } catch (e) {
                console.error(`[ExplodingKittens] Failed to join room:`, e);
                // Show welcome screen with room ID prefilled
                showWelcomeScreen(roomIdFromUrl);
            }
        })();
    } else {
        // Show welcome screen (with room ID if available)
        console.log(`[ExplodingKittens] Missing info, showing welcome screen`);
        showWelcomeScreen(roomIdFromUrl || '');
    }
}