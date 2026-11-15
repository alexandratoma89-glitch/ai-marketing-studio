import {randomInt} from 'node:crypto';
import {DECK,type Card} from './deck-data.ts';
export {DECK,type Card} from './deck-data.ts';
export function drawCard(index: (max:number)=>number = randomInt): Card { const n=index(DECK.length);if(!Number.isInteger(n)||n<0||n>=DECK.length)throw new Error('Invalid random index');return DECK[n]; }
