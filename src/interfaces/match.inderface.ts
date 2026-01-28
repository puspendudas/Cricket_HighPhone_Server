//match.interface.ts

import { Document } from 'mongoose';

interface Match {
    id?: any;
    gameId: string;
    marketId: string;
    eventId: string;
    eventName: string;
    bm_lock: any[];
    fancy_lock: any[];
    bet_delay: number;
    selectionId1: number;
    runnerName1: string | null;
    selectionId2: number;
    runnerName2: string | null;
    selectionId3: number;
    runnerName3: string | null;
    eventTime: string;
    inPlay: boolean;
    status: boolean;
    tv: string | null;
    back1: number;
    lay1: number;
    back11: number;
    lay11: number;
    back12: number;
    lay12: number;
    m1: string | null;
    f: string | null;
    vir: number;
    channel: string | null;
    scoreBoardId: string | null;
    seriesId: string;
    seriesName: string;
    fancyOdds: any[];
    matchOdds: any[];
    bookMakerOdds: any[];
    otherMarketOdds: any[];
    teams: any[];
    declared: boolean;
    wonby: string | null;
    min: number;
    max: number;
    isBMEnded: boolean;
    isMatchEnded: boolean;
}

interface MatchDocument extends Match, Document {
    id: string;
}

export { Match, MatchDocument };
