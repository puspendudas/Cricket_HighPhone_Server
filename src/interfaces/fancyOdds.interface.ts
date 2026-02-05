//fancyOdds.interface.ts

import { Document, ObjectId } from "mongoose";


interface FancyOdds {
    id: string;
    matchId: ObjectId;
    gameId: string;
    marketId: string;
    market: string;
    sid: number;
    b1: string;
    bs1: string;
    l1: string;
    ls1: string;
    status: string;
    remark: string;
    min: number;
    max: number;
    sno: string;
    rname: string;
    isActive: boolean;
    isEnabled: boolean;
    isDeclared: boolean;
    isAuto: boolean;
    isFancyEnded: boolean;
    resultScore: string;
}

interface FancyOddsData {
    mid: string;
    market: string;
    iPlay: boolean;
    sid: number | null;
    status: string;
    oddDatas: FancyOddsAPIData[];
    max: number;
    min: number;
    mstatus: string;
    gtype: string | null;
    mname: string;
}

interface FancyOddsAPIData {
    sid: number;
    b1: string;
    bs1: string;
    b2: string | null;
    bs2: string | null;
    b3: string | null;
    bs3: string | null;
    l1: string;
    ls1: string;
    l2: string | null;
    ls2: string | null;
    l3: string | null;
    ls3: string | null;
    status: string;
    remark: string;
    min: number;
    max: number;
    sno: string | null;
    gtype: string | null;
    rname: string;
}

interface FancyOddsDocument extends FancyOdds, Document {
    id: string;
}

export { FancyOdds, FancyOddsDocument, FancyOddsData };
