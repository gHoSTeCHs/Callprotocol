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
            console.log(`Requesting media with video: ${video}`);

            const videoConstraints = video
                ? {
                      width: { ideal: 1280 },
                      height: { ideal: 720 },
                      facingMode: 'user',
                  }
                : false;

            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: videoConstraints,
            });

            console.log('Local stream obtained:', this.localStream);
            console.log('Video tracks:', this.localStream.getVideoTracks().length);
            console.log('Audio tracks:', this.localStream.getAudioTracks().length);

            if (video && this.localStream.getVideoTracks().length === 0) {
                console.warn('No video tracks available despite video being requested!');
            }

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

        // Create and send offer
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            // Send the offer via signaling channel
            this.onSignalingMessage({
                type: 'offer',
                sdp: offer,
            });
        } catch (error) {
            console.error('Error creating offer:', error);
            throw error;
        }
    }

    public async handleIncomingCall(offer: RTCSessionDescriptionInit | string): Promise<void> {
        this.isInitiator = false;

        if (!this.peerConnection || !this.localStream) {
            throw new Error('Peer connection or local stream not set up');
        }

        // Add local tracks to the peer connection
        this.localStream.getTracks().forEach((track) => {
            if (this.peerConnection && this.localStream) {
                this.peerConnection.addTrack(track, this.localStream);
            }
        });

        // Set the remote offer
        try {
            let sessionDesc: RTCSessionDescription;

            // Handle the different possible formats of the offer
            if (typeof offer === 'string') {
                try {
                    // Check if it's a stringified JSON object
                    const parsedOffer = JSON.parse(offer);
                    if (parsedOffer && parsedOffer.sdp && parsedOffer.type) {
                        sessionDesc = new RTCSessionDescription({
                            type: parsedOffer.type as RTCSdpType,
                            sdp: parsedOffer.sdp,
                        });
                    } else {
                        // If it's not valid JSON with sdp and type, try using it directly as SDP
                        sessionDesc = new RTCSessionDescription({
                            type: 'offer',
                            sdp: offer,
                        });
                    }
                } catch (e) {
                    // If JSON parsing fails, use it directly as SDP
                    sessionDesc = new RTCSessionDescription({
                        type: 'offer',
                        sdp: offer,
                    });
                }
            } else if (typeof offer === 'object') {
                // If it's already an object
                if (offer.sdp && typeof offer.sdp === 'object') {
                    // If sdp is an object, stringify it (in case it's a JSON representation)
                    sessionDesc = new RTCSessionDescription({
                        type: offer.type as RTCSdpType,
                        sdp: JSON.stringify(offer.sdp),
                    });
                } else {
                    // Use the object directly
                    sessionDesc = new RTCSessionDescription(offer);
                }
            } else {
                throw new Error('Invalid offer format');
            }

            console.log('Using session description:', sessionDesc);

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

    public ensureVideoEnabled(): void {
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach((track) => {
                track.enabled = true;
            });
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

    private setupPeerConnection(): void {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                // Add your TURN server credentials here if needed
            ],
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
            console.log('Connection state changed to:', this.peerConnection?.connectionState);

            if (this.peerConnection?.connectionState === 'connected') {
                console.log('Connection established!');
                console.log(
                    'Video tracks in remote streams:',
                    this.peerConnection.getReceivers().filter((receiver) => receiver.track.kind === 'video').length,
                );
            }
        };

        // Handle remote streams
        this.peerConnection.ontrack = (event) => {
            console.log('Remote track received:', event);
            console.log('Remote track type:', event.track.kind);
            console.log('Remote stream has video tracks:', event.streams[0].getVideoTracks().length);
            console.log('Remote stream has audio tracks:', event.streams[0].getAudioTracks().length);

            this.remoteStream = event.streams[0];

            if (this.onRemoteStreamCallback) {
                this.onRemoteStreamCallback(this.remoteStream);
            }
        };
    }
}
