import type { Case } from '../types.js';
export type Event = {
    type: string;
    [key: string]: unknown;
};
export declare const assertCase: (c: Case, events: Event[]) => boolean;
