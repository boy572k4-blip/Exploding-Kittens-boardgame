import {DiscordSDK} from "@discord/embedded-app-sdk";

export type AuthResponse = Awaited<ReturnType<typeof DiscordSDK.prototype.commands.authenticate>>

export async function setupDiscordSdk(discordSdk: DiscordSDK) {
    let auth: AuthResponse;

    await discordSdk.ready();
    console.log("[ExplodingKittens] Discord SDK is ready");

    // Authorize with Discord Client
    const {code} = await discordSdk.commands.authorize({
        client_id: "1248976494152122419",
        response_type: "code",
        state: "",
        prompt: "none",
        scope: [
            "identify",
            "guilds",
        ],
    });

    // Retrieve an access_token from your activity's server
    const response = await fetch((process.env.NODE_ENV === "development" ? "http://localhost:7777" : "/.proxy/api") + "/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            code,
        }),
    });
    const {access_token} = await response.json();

    // Authenticate with Discord client (using the access_token)
    auth = await discordSdk.commands.authenticate({
        access_token,
    });

    if (auth == null) {
        throw new Error("Authenticate command failed");
    }

    return auth;
}