export declare const ahNum: number;
export declare const socket: WebSocket;
export declare const connected: boolean;
export declare const socketId: number;
export declare const sendQueue: unknown[];
export declare const trackPacketStats: boolean;
export declare const ingressPacketCount: number;
export declare const ingressDataSize: number;
export declare const egressPacketCount: number;
export declare const egressDataSize: number;
export declare const captchaHolder: HTMLElement | null;
export declare function send(packet: string, ...data: unknown[]): void;
export declare function _dispatchEvent(
  packet: string,
  ...data: unknown[]
): void;
