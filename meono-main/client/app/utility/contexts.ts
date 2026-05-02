import { AuthResponse } from "./discord_sdk";
import { DiscordSDK } from "@discord/embedded-app-sdk";
import { createContext, Dispatch, SetStateAction } from "react";
import { colyseus } from "@p3ntest/use-colyseus"
import { GameRoomState } from "../../../server/src/rooms/schema/GameRoomState";

export class DiscordSDKContextType {
    constructor() {
        this.discordSDK = {} as unknown as DiscordSDK;
        this.auth = {} as unknown as AuthResponse;
    }

    auth: AuthResponse
    discordSDK: DiscordSDK
}

export const DiscordSDKContext = createContext(new DiscordSDKContextType());

export class LocalStorageContextType {
    constructor(showTooltips: boolean, setShowTooltips: Dispatch<SetStateAction<boolean>>) {
        this.showTooltips = showTooltips;
        this.setShowTooltips = setShowTooltips;
    }

    showTooltips: boolean = true;
    setShowTooltips: Dispatch<SetStateAction<boolean>>;
}

export const LocalStorageContext = createContext(new LocalStorageContextType(true, () => { }));

// Cấu hình server URL
// Để chơi local: "http://localhost:8888/"
// Để chơi qua ngrok: tạo file .env và set VITE_SERVER_URL=https://your-ngrok-url.ngrok-free.app/
const SERVER_URL = import.meta.env.VITE_SERVER_URL ||
    (process.env.NODE_ENV === "development"
        ? "http://localhost:8888/"
        : `${window.location.origin}/`);

export const {
    client,
    setCurrentRoom,
    useColyseusRoom,
    useColyseusState
} = colyseus<GameRoomState>(SERVER_URL);