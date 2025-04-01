// // Type definitions for Laravel Echo
// declare module 'laravel-echo' {
//     interface ChannelOptions {
//         auth?: {
//             headers?: Record<string, string>;
//         };
//         authEndpoint?: string;
//         namespace?: string;
//     }
//
//     interface PusherOptions {
//         auth?: {
//             headers?: Record<string, string>;
//         };
//         authEndpoint?: string;
//         cluster?: string;
//         disableStats?: boolean;
//         enabledTransports?: string[];
//         forceTLS?: boolean;
//         key?: string;
//         host?: string;
//         port?: number;
//         encrypted?: boolean;
//         wsHost?: string;
//         wsPort?: number;
//         wssPort?: number;
//
//
//     }
//
//     interface SocketIoOptions {
//         host?: string;
//         port?: number;
//         reconnectionAttempts?: number;
//         reconnectionDelay?: number;
//         reconnectionDelayMax?: number;
//         secure?: boolean;
//     }
//
//     interface Channel {
//         listen(event: string, callback: (data: any) => void): Channel;
//         stopListening(event: string, callback?: (data: any) => void): Channel;
//         subscribed(callback: Function): Channel;
//         error(callback: Function): Channel;
//         on(event: string, callback: Function): Channel;
//     }
//
//     interface PresenceChannel extends Channel {
//         here(callback: (users: any[]) => void): PresenceChannel;
//         joining(callback: (user: any) => void): PresenceChannel;
//         leaving(callback: (user: any) => void): PresenceChannel;
//         whisper(eventName: string, data: any): PresenceChannel;
//     }
//
//     interface EchoOptions {
//         broadcaster?: 'pusher' | 'socket.io' | 'null';
//         client?: any;
//         key?: string;
//         namespace?: string;
//         [key: string]: any;
//     }
//
//     export default class Echo {
//         constructor(options: EchoOptions);
//         channel(channel: string): Channel;
//         private(channel: string): Channel;
//         join(channel: string): PresenceChannel;
//         leave(channel: string): void;
//         leaveChannel(channel: string): void;
//         leaveAllChannels(): void;
//         socket: any;
//         connector: any;
//         connect(): void;
//         disconnect(): void;
//     }
// }
//
//
// declare global {
//     interface Window {
//         Echo: import('laravel-echo').default;
//         userId: number;
//     }
// }
