import type {ClientMessage,ServerMessage} from '../../contracts';
export function parseClient(_raw:string):ClientMessage{throw new Error('Protocol validation pending');}
export function parseServer(_raw:string):ServerMessage{throw new Error('Protocol validation pending');}
export function encode(_message:ClientMessage|ServerMessage):string{throw new Error('Protocol encoding pending');}
