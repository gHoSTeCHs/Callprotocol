import axios from 'axios';
import Peer, { MediaConnection } from 'peerjs';
import React from 'react';

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
    };
}

type CallStatusChangeCallback = (status: boolean) => void;

class WebRTCManager {
    private readonly userId: string | number;
    private localVideoRef: React.RefObject<HTMLVideoElement | null>;
    private remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
    private onCallStatusChange: CallStatusChangeCallback;

    private peer: Peer;
    private peerCall: MediaConnection | null;
    private localStream: MediaStream | null;
    private selectedUser: User | null;
    private isCalling: boolean;

    constructor(
        userId: string | number,
        localVideoRef: React.RefObject<HTMLVideoElement | null>,
        remoteVideoRef: React.RefObject<HTMLVideoElement | null>,
        onCallStatusChange: CallStatusChangeCallback = () => {},
    ) {
        this.userId = userId;
        this.localVideoRef = localVideoRef;
        this.remoteVideoRef = remoteVideoRef;
        this.onCallStatusChange = onCallStatusChange;

        this.peer = new Peer();
        this.peerCall = null;
        this.localStream = null;
        this.selectedUser = null;
        this.isCalling = false;

        // Initialize the WebRTC connection
        this.setupPeerEvents();
        this.connectWebSocket();
    }

    private setupPeerEvents(): void {
        this.peer.on('open', (id: string) => {
            console.log('My peer ID is: ' + id);
        });

        this.peer.on('error', (err: Error) => {
            console.error('Peer connection error:', err);
            this.updateCallStatus(false);
        });
    }

    private connectWebSocket(): void {
        // Request video call
        window.Echo.private(`video-call.${this.userId}`).listen('RequestVideoCall', (e: RequestVideoCallEvent) => {
            this.selectedUser = e.user.fromUser;
            this.updateCallStatus(true);
            this.recipientAcceptCall(e);
            this.displayLocalVideo();
        });

        // Video call request accepted
        window.Echo.private(`video-call.${this.userId}`).listen('RequestVideoCallStatus', (e: RequestVideoCallStatusEvent) => {
            this.createConnection(e);
        });
    }

    public disconnect(): void {
        if (this.isCalling) {
            this.endCall();
        }
        window.Echo.leave(`video-call.${this.userId}`);
        this.peer.destroy();
    }

    private updateCallStatus(status: boolean): void {
        this.isCalling = status;
        this.onCallStatusChange(status);
    }

    public setSelectedUser(user: User): void {
        this.selectedUser = user;
    }

    public callUser(): void {
        if (!this.selectedUser) {
            console.error('No user selected to call');
            return;
        }

        const payload = {
            peerId: this.peer.id,
        };

        axios.post(`/video-call/request/${this.selectedUser.id}`, payload).then();
        this.updateCallStatus(true);
        this.displayLocalVideo();
    }

    private displayLocalVideo(): void {
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
                this.updateCallStatus(false);
            });
    }

    private recipientAcceptCall(e: RequestVideoCallEvent): void {
        // Send signal that recipient accepts the call
        axios
            .post(`/video-call/request/status/${e.user.fromUser.id}`, {
                peerId: this.peer.id,
                status: 'accept',
            })
            .then();

        // Stand by for caller's connection
        this.peer.on('call', (call: MediaConnection) => {
            this.peerCall = call;

            // Accept call if the caller is the one that you accepted
            if (e.user.peerId === call.peer) {
                navigator.mediaDevices
                    .getUserMedia({ video: true, audio: true })
                    .then((stream: MediaStream) => {
                        // Answer the call with your stream
                        call.answer(stream);
                        this.localStream = stream;

                        // Listen for the caller's stream
                        call.on('stream', (remoteStream: MediaStream) => {
                            if (this.remoteVideoRef.current) {
                                this.remoteVideoRef.current.srcObject = remoteStream;
                            }
                        });

                        // Caller ends the call
                        call.on('close', () => {
                            this.endCall();
                        });
                    })
                    .catch((err: Error) => {
                        console.error('Error accessing media devices:', err);
                        this.updateCallStatus(false);
                    });
            }
        });
    }

    private createConnection(e: RequestVideoCallStatusEvent): void {
        const receiverId = e.user.peerId;

        navigator.mediaDevices
            .getUserMedia({ video: true, audio: true })
            .then((stream: MediaStream) => {
                // Initiate the call with the receiver's ID
                const call = this.peer.call(receiverId, stream);
                this.peerCall = call;
                this.localStream = stream;

                if (this.localVideoRef.current) {
                    this.localVideoRef.current.srcObject = stream;
                }

                // Listen for the receiver's stream
                call.on('stream', (remoteStream: MediaStream) => {
                    if (this.remoteVideoRef.current) {
                        this.remoteVideoRef.current.srcObject = remoteStream;
                    }
                });

                // Receiver ends the call
                call.on('close', () => {
                    this.endCall();
                });
            })
            .catch((err: Error) => {
                console.error('Error accessing media devices:', err);
                this.updateCallStatus(false);
            });
    }

    public endCall(): void {
        if (this.peerCall) {
            this.peerCall.close();
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => track.stop());
        }

        if (this.localVideoRef.current) {
            this.localVideoRef.current.srcObject = null;
        }

        if (this.remoteVideoRef.current) {
            this.remoteVideoRef.current.srcObject = null;
        }

        this.updateCallStatus(false);
    }
}

export default WebRTCManager;
