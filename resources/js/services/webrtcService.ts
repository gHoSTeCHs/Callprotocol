// services/WebRTCService.ts

export class WebRTCService {
    private peerConnection: RTCPeerConnection | null = null;
    private localStream: MediaStream | null = null;
    private remoteStream: MediaStream | null = null;
    private isInitiator: boolean = false;
    private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
    private pendingIceCandidates: RTCIceCandidateInit[] = [];

    constructor(private onSignalingMessage: (message: any) => void) {
        this.setupPeerConnection();
    }

    public async startLocalStream(video: boolean = true): Promise<MediaStream> {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video,
            });
            return this.localStream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw error;
        }
    }

    public stopLocalStream(): void {
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => track.stop());
            this.localStream = null;
        }
    }

    public setRemoteStreamCallback(callback: (stream: MediaStream) => void): void {
        this.onRemoteStreamCallback = callback;

        if (this.remoteStream && callback) {
            callback(this.remoteStream);
        }
    }

    public async initiateCall(): Promise<void> {
        this.isInitiator = true;

        if (!this.peerConnection || !this.localStream) {
            throw new Error('Peer connection or local stream not set up');
        }

        // Add local tracks to the peer connection
        this.localStream.getTracks().forEach((track) => {
            if (this.peerConnection && this.localStream) {
                this.peerConnection.addTrack(track, this.localStream);
            }
        });

        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            this.onSignalingMessage({
                type: 'offer',
                sdp: offer,
            });
        } catch (error) {
            console.error('Error creating offer:', error);
            throw error;
        }
    }

    public async handleIncomingCall(offer: RTCSessionDescriptionInit): Promise<void> {
        this.isInitiator = false;

        if (!this.peerConnection || !this.localStream) {
            throw new Error('Peer connection or local stream not set up');
        }

        this.localStream.getTracks().forEach((track) => {
            if (this.peerConnection && this.localStream) {
                this.peerConnection.addTrack(track, this.localStream);
            }
        });

        try {
            const sessionDesc =
                typeof offer === 'object' && offer.sdp
                    ? new RTCSessionDescription({
                          type: 'offer',
                          sdp: typeof offer.sdp === 'string' ? offer.sdp : JSON.stringify(offer.sdp),
                      })
                    : new RTCSessionDescription(offer);

            await this.peerConnection.setRemoteDescription(sessionDesc);
            await this.processPendingIceCandidates();

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.onSignalingMessage({
                type: 'answer',
                sdp: answer,
            });
        } catch (error) {
            console.error('Error creating answer:', error);
            throw error;
        }
    }

    public async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
        if (!this.peerConnection) {
            throw new Error('Peer connection not set up');
        }

        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

            await this.processPendingIceCandidates();
        } catch (error) {
            console.error('Error setting remote description:', error);
            throw error;
        }
    }

    public async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
        if (!this.peerConnection) {
            throw new Error('Peer connection not set up');
        }

        // If remote description is not set yet, store the candidate
        if (!this.peerConnection.remoteDescription) {
            console.log('Storing ICE candidate until remote description is set');
            this.pendingIceCandidates.push(candidate);
            return;
        }

        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
            throw error;
        }
    }

    public toggleMute(muted: boolean): void {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach((track) => {
                track.enabled = !muted;
            });
        }
    }

    public toggleVideo(videoOff: boolean): void {
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach((track) => {
                track.enabled = !videoOff;
            });
        }
    }

    public disconnect(): void {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        this.stopLocalStream();
        this.remoteStream = null;
        this.isInitiator = false;
    }

    private async processPendingIceCandidates(): Promise<void> {
        if (!this.peerConnection || !this.pendingIceCandidates.length) return;

        console.log(`Processing ${this.pendingIceCandidates.length} pending ICE candidates`);

        for (const candidate of this.pendingIceCandidates) {
            try {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('Error adding pending ICE candidate:', error);
            }
        }

        this.pendingIceCandidates = [];
    }

    private setupPeerConnection(): void {
        const configuration = {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        };

        this.peerConnection = new RTCPeerConnection(configuration);

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.onSignalingMessage({
                    type: 'candidate',
                    candidate: event.candidate,
                });
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection?.connectionState);
        };

        // Handle remote streams
        this.peerConnection.ontrack = (event) => {
            console.log('Remote track received:', event.streams[0]);
            this.remoteStream = event.streams[0];

            if (this.onRemoteStreamCallback) {
                this.onRemoteStreamCallback(this.remoteStream);
            }
        };
    }
}
