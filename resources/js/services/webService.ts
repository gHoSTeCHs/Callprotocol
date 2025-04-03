import axios from 'axios';
import Peer, { MediaConnection } from 'peerjs';
import React from 'react';

enum CallState {
    IDLE = 'idle',
    INITIATING = 'initiating',
    RINGING = 'ringing',
    CONNECTED = 'connected',
    ENDING = 'ending'
}


interface User {
    id: string | number;

    [key: string]: any;
}

interface RequestVideoCallEvent {
    user: {
        fromUser: User;
        peerId: string;
    };
}

interface RequestVideoCallStatusEvent {
    user: {
        peerId: string;
        status: 'accept' | 'reject';
    };
}

type CallStatusChangeCallback = (status: CallState) => void;
type ErrorCallback = (error: string) => void;

class WebRTCManager {
    private readonly userId: string | number;
    private localVideoRef: React.RefObject<HTMLVideoElement | null>;
    private remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
    private readonly onCallStatusChange: CallStatusChangeCallback;
    private readonly onError: ErrorCallback;

    private peer: Peer;
    private peerCall: MediaConnection | null;
    private localStream: MediaStream | null;
    private selectedUser: User | null;
    private callState: CallState;
    private eventListeners: (() => void)[] = [];
    private connectionTimeout: NodeJS.Timeout | null = null;
    private callTimeouts: NodeJS.Timeout[] = [];
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 3;

    constructor(
        userId: string | number,
        localVideoRef: React.RefObject<HTMLVideoElement | null>,
        remoteVideoRef: React.RefObject<HTMLVideoElement | null>,
        onCallStatusChange: CallStatusChangeCallback = () => {},
        onError: ErrorCallback = () => {},
    ) {
        this.userId = userId;
        this.localVideoRef = localVideoRef;
        this.remoteVideoRef = remoteVideoRef;
        this.onCallStatusChange = onCallStatusChange;
        this.onError = onError;
        this.callState = CallState.IDLE;


        const peerId = `user-${userId}-${Date.now().toString(36)}`;

        try {
            this.peer = new Peer(peerId, {

                config: {
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
                },
            });
        } catch (error) {
            console.error('Failed to initialize Peer:', error);
            this.onError('Failed to initialize call service. Please refresh and try again.');

            this.peer = new Peer();
        }

        this.peerCall = null;
        this.localStream = null;
        this.selectedUser = null;


        this.setupPeerEvents();
        this.connectWebSocket();
    }

    private setupPeerEvents(): void {
        this.peer.on('open', (id: string) => {
            console.log('My peer ID is: ' + id);

            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            this.reconnectAttempts = 0;
        });

        this.peer.on('error', (err: Error) => {
            console.error('Peer connection error:', err);
            this.onError(`Connection error: ${err.message}`);
            this.updateCallStatus(CallState.IDLE);


            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                this.tryReconnect();
            }
        });


        this.peer.on('disconnected', () => {
            console.log('Peer disconnected');


            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                this.peer.reconnect();
            } else {
                this.updateCallStatus(CallState.IDLE);
                this.onError('Call disconnected. Network may be unstable.');
            }
        });


        this.peer.on('close', () => {
            console.log('Peer connection closed');
            this.updateCallStatus(CallState.IDLE);
        });


        this.connectionTimeout = setTimeout(() => {
            if (!this.peer.open) {
                this.onError('Connection timeout. Network may be unstable.');
                this.tryReconnect();
            }
        }, 10000);
    }

    private tryReconnect(): void {

        if (!this.peer.destroyed) {
            this.peer.destroy();
        }


        const peerId = `user-${this.userId}-${Date.now().toString(36)}`;
        this.peer = new Peer(peerId, {
            config: {
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
            },
        });


        this.setupPeerEvents();
    }

    private connectWebSocket(): void {
        if (!window.Echo) {
            console.error('Echo not initialized');
            this.onError('Notification service not available. Call functionality may be limited.');
            return;
        }

        try {
            const videoCallChannel = window.Echo.private(`video-call.${this.userId}`);

            const requestVideoCallListener = (e: RequestVideoCallEvent) => {
                this.selectedUser = e.user.fromUser;
                this.updateCallStatus(CallState.RINGING);
                this.recipientAcceptCall(e);
                this.displayLocalVideo();
            };

            const requestVideoCallStatusListener = (e: RequestVideoCallStatusEvent) => {
                if (e.user.status === 'accept') {
                    this.createConnection(e);
                } else if (e.user.status === 'reject') {
                    this.endCall();
                    this.onError('Call was rejected by the recipient.');
                }
            };

            videoCallChannel.listen('RequestVideoCall', requestVideoCallListener);
            videoCallChannel.listen('RequestVideoCallStatus', requestVideoCallStatusListener);

            this.eventListeners.push(() => {
                videoCallChannel.stopListening('RequestVideoCall');
                videoCallChannel.stopListening('RequestVideoCallStatus');
            });
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            this.onError('Failed to establish notification channel. Call functionality may be limited.');
        }
    }

    public disconnect(): void {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }

        this.callTimeouts.forEach((timeout) => clearTimeout(timeout));
        this.callTimeouts = [];

        if (this.callState !== CallState.IDLE) {
            this.endCall();
        }

        this.eventListeners.forEach((removeListener) => removeListener());
        this.eventListeners = [];

        if (this.peer && !this.peer.destroyed) {
            this.peer.destroy();
        }
    }

    private updateCallStatus(status: CallState): void {
        this.callState = status;
        this.onCallStatusChange(status);
    }

    public setSelectedUser(user: User): void {
        this.selectedUser = user;
    }

    public callUser(): void {
        if (!this.selectedUser) {
            console.error('No user selected to call');
            this.onError('No contact selected to call.');
            return;
        }


        if (!this.peer.open) {
            console.error('Peer not connected');
            this.onError('Connection not ready. Please try again in a moment.');
            return;
        }

        const payload = {
            peerId: this.peer.id,
        };

        axios
            .post(`/video-call/request/${this.selectedUser.id}`, payload)
            .then((response) => {
                console.log('Call request sent successfully', response);
                this.updateCallStatus(CallState.RINGING);
            })
            .catch((error) => {
                console.error('Failed to send call request:', error);
                this.updateCallStatus(CallState.IDLE);
                this.onError('Failed to initiate call. The server may be unavailable.');
            });

        this.updateCallStatus(CallState.INITIATING);
        this.displayLocalVideo();


        const callTimeout = setTimeout(() => {
            if (this.callState !== CallState.CONNECTED) {
                this.onError('Call timed out. The recipient may be unavailable.');
                this.endCall();
            }
        }, 30000);

        this.callTimeouts.push(callTimeout);
    }

    private displayLocalVideo(): void {

        if (this.localStream) {
            if (this.localVideoRef.current) {
                this.localVideoRef.current.srcObject = this.localStream;
            }
            return;
        }

        navigator.mediaDevices
            .getUserMedia({ video: true, audio: true })
            .then((stream: MediaStream) => {
                if (this.localVideoRef.current) {
                    this.localVideoRef.current.srcObject = stream;
                    this.localStream = stream;
                }
            })
            .catch((err: Error) => {
                console.error('Error accessing media devices:', err);
                this.updateCallStatus(CallState.IDLE);


                if (err.name === 'NotAllowedError') {
                    this.onError('Camera or microphone access denied. Please check your permissions.');
                } else if (err.name === 'NotFoundError') {
                    this.onError('Camera or microphone not found. Please check your devices.');
                } else {
                    this.onError(`Could not access camera or microphone: ${err.message}`);
                }
            });
    }

    private recipientAcceptCall(e: RequestVideoCallEvent): void {

        axios
            .post(`/video-call/request/status/${e.user.fromUser.id}`, {
                peerId: this.peer.id,
                status: 'accept',
            })
            .then((response) => {
                console.log('Call acceptance sent successfully', response);
            })
            .catch((error) => {
                console.error('Failed to send call acceptance:', error);
                this.updateCallStatus(CallState.IDLE);
                this.onError('Failed to accept call. The connection may be unstable.');
            });


        const callHandler = (call: MediaConnection) => {
            this.peerCall = call;


            if (e.user.peerId === call.peer) {
                navigator.mediaDevices
                    .getUserMedia({ video: true, audio: true })
                    .then((stream: MediaStream) => {

                        call.answer(stream);
                        this.localStream = stream;

                        if (this.localVideoRef.current) {
                            this.localVideoRef.current.srcObject = stream;
                        }


                        call.on('stream', (remoteStream: MediaStream) => {
                            if (this.remoteVideoRef.current) {
                                this.remoteVideoRef.current.srcObject = remoteStream;
                                this.updateCallStatus(CallState.CONNECTED);
                            }
                        });


                        call.on('error', (err) => {
                            console.error('Call error:', err);
                            this.onError(`Call error: ${err.message}`);
                            this.updateCallStatus(CallState.IDLE);
                        });


                        call.on('close', () => {
                            console.log('Call closed');
                            this.updateCallStatus(CallState.IDLE);
                            this.cleanupMediaStreams();
                        });
                    })
                    .catch((err) => {
                        console.error('Error accessing media devices:', err);
                        this.onError('Could not access camera or microphone. Please check your permissions.');
                        this.updateCallStatus(CallState.IDLE);
                    });
            }
        };

        this.peer.on('call', callHandler);
        this.eventListeners.push(() => {
            this.peer.off('call', callHandler);
        });
    }

    private createConnection(e: RequestVideoCallStatusEvent): void {
        if (!this.localStream) {
            navigator.mediaDevices
                .getUserMedia({ video: true, audio: true })
                .then((stream: MediaStream) => {
                    this.localStream = stream;
                    if (this.localVideoRef.current) {
                        this.localVideoRef.current.srcObject = stream;
                    }
                    this.initiateCallConnection(e.user.peerId, stream);
                })
                .catch((err) => {
                    console.error('Error accessing media devices:', err);
                    this.onError('Could not access camera or microphone. Please check your permissions.');
                    this.updateCallStatus(CallState.IDLE);
                });
        } else {
            this.initiateCallConnection(e.user.peerId, this.localStream);
        }
    }

    private initiateCallConnection(peerId: string, stream: MediaStream): void {
        try {

            const call = this.peer.call(peerId, stream);
            this.peerCall = call;


            call.on('stream', (remoteStream: MediaStream) => {
                if (this.remoteVideoRef.current) {
                    this.remoteVideoRef.current.srcObject = remoteStream;
                    this.updateCallStatus(CallState.CONNECTED);
                }
            });


            call.on('error', (err) => {
                console.error('Call error:', err);
                this.onError(`Call error: ${err.message}`);
                this.updateCallStatus(CallState.IDLE);
            });


            call.on('close', () => {
                console.log('Call closed');
                this.updateCallStatus(CallState.IDLE);
                this.cleanupMediaStreams();
            });
        } catch (error) {
            console.error('Failed to initiate call connection:', error);
            this.onError('Failed to establish call connection. Please try again.');
            this.updateCallStatus(CallState.IDLE);
        }
    }

    public endCall(): void {
        this.updateCallStatus(CallState.ENDING);

        if (this.peerCall) {
            this.peerCall.close();
            this.peerCall = null;
        }

        this.cleanupMediaStreams();
        this.updateCallStatus(CallState.IDLE);
    }

    private cleanupMediaStreams(): void {

        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
                track.stop();
            });
            this.localStream = null;
        }


        if (this.localVideoRef.current) {
            this.localVideoRef.current.srcObject = null;
        }

        if (this.remoteVideoRef.current) {
            this.remoteVideoRef.current.srcObject = null;
        }
    }
}

export default WebRTCManager;
