import {Card} from "./card";

export function isCatCard(card: number): boolean {
    return ([Card.TACOCAT, Card.BEARDCAT, Card.RAINBOWCAT, Card.CATTERMELON, Card.POTATOCAT, Card.FERALCAT] as Array<number>).includes(card);
}

export enum TurnState {
    Normal,
    AlteringTheFuture,
    Favouring,
    Noping,
    ChoosingExplodingPosition,
    ChoosingImplodingPosition,
    GameOver
}