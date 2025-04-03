import Echo from 'laravel-echo';

interface OfferObject {
    offer: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
}

export class WebRTCService {
    private localStream: MediaStream | undefined;
    private remoteStream: MediaStream | undefined;
    private peerConnection: RTCPeerConnection | undefined;
    private didIOffer = false;
    private localVideoEl: HTMLVideoElement;
    private remoteVideoEl: HTMLVideoElement;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    private echo: Echo;
    private readonly channelName: string;
    private readonly userName: string;

    private readonly peerConfiguration: RTCConfiguration = {
        iceServers: [
            {
                urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
            },
        ],
    };

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    constructor(echo: Echo, channelName: string, userName: string, localVideoElementId: string, remoteVideoElementId: string) {
        this.echo = echo;
        this.channelName = channelName;
        this.userName = userName;

        const localEl = document.getElementById(localVideoElementId);
        const remoteEl = document.getElementById(remoteVideoElementId);

        if (!localEl || !remoteEl) {
            throw new Error('Video elements not found');
        }

        this.localVideoEl = localEl as HTMLVideoElement;
        this.remoteVideoEl = remoteEl as HTMLVideoElement;

        this.setupEchoListeners();

        const callButton = document.getElementById('call');
        if (callButton) {
            callButton.addEventListener('click', () => this.call());
        }
    }

    /**
     * Set up Echo channel listeners
     */
    private setupEchoListeners(): void {
        // Join a presence channel for the WebRTC signaling
        const channel = this.echo.join(this.channelName);

        // Listen for new offers
        channel.listen('NewOfferEvent', (data: { offerObj: OfferObject }) => {
            this.answerOffer(data.offerObj).then();
        });

        // Listen for answers to our offers
        channel.listen('AnswerResponseEvent', (data: { offerObj: OfferObject }) => {
            this.addAnswer(data.offerObj).then();
        });

        // Listen for ICE candidates
        channel.listen('IceCandidateEvent', (data: { iceCandidate: RTCIceCandidate }) => {
            this.addNewIceCandidate(data.iceCandidate);
        });
    }

    public async call(): Promise<void> {
        await this.fetchUserMedia();
        await this.createPeerConnection();

        try {
            console.log('Creating offer...');
            const offer = await this.peerConnection!.createOffer();
            console.log(offer);
            await this.peerConnection!.setLocalDescription(offer);
            this.didIOffer = true;

            this.echo.private(this.channelName).whisper('newOffer', { offer });
        } catch (err) {
            console.log(err);
        }
    }

    public async answerOffer(offerObj: OfferObject): Promise<void> {
        await this.fetchUserMedia();
        await this.createPeerConnection(offerObj);
        const answer = await this.peerConnection!.createAnswer({});
        await this.peerConnection!.setLocalDescription(answer);
        console.log(offerObj);
        console.log(answer);

        offerObj.answer = answer;

        this.echo.private(this.channelName).whisper('newAnswer', { offerObj });
    }

    /**
     * Adds an answer to an offer that was previously sent
     */

    public async addAnswer(offerObj: OfferObject): Promise<void> {
        if (offerObj.answer && this.peerConnection) {
            await this.peerConnection.setRemoteDescription(offerObj.answer);
        }
    }

    public addNewIceCandidate(iceCandidate: RTCIceCandidate): void {
        if (this.peerConnection) {
            this.peerConnection.addIceCandidate(iceCandidate).then();
            console.log('======Added Ice Candidate======');
        }
    }

    private async fetchUserMedia(): Promise<void> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            this.localVideoEl.srcObject = stream;
            this.localStream = stream;
        } catch (err) {
            console.log(err);
            throw new Error('Failed to get user media');
        }
    }

    /**
     * Creates the RTCPeerConnection and sets up event listeners
     */
    private async createPeerConnection(offerObj?: OfferObject): Promise<void> {
        this.peerConnection = new RTCPeerConnection(this.peerConfiguration);
        this.remoteStream = new MediaStream();
        this.remoteVideoEl.srcObject = this.remoteStream;

        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
                this.peerConnection!.addTrack(track, this.localStream!);
            });
        }

        // Set up signaling state change event listener
        this.peerConnection.addEventListener('signalingstatechange', (event: Event) => {
            console.log(event);
            console.log(this.peerConnection!.signalingState);
        });

        // Set up ICE candidate event listener
        this.peerConnection.addEventListener('icecandidate', (e: RTCPeerConnectionIceEvent) => {
            console.log('........Ice candidate found!......');
            console.log(e);
            if (e.candidate) {
                // Send ICE candidate through Laravel Echo
                this.echo.private(this.channelName).whisper('iceCandidate', {
                    iceCandidate: e.candidate,
                    iceUserName: this.userName,
                    didIOffer: this.didIOffer,
                });
            }
        });

        // Set up track event listener to handle incoming media
        this.peerConnection.addEventListener('track', (e: RTCTrackEvent) => {
            console.log('Got a track from the other peer!! How exciting');
            console.log(e);
            e.streams[0].getTracks().forEach((track) => {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                this.remoteStream!.addTrack(track, this.remoteStream!);
                console.log("Here's an exciting moment... fingers crossed");
            });
        });

        // If we have an offer, set it as the remote description
        if (offerObj) {
            await this.peerConnection.setRemoteDescription(offerObj.offer);
        }
    }

    /**
     * Cleanup resources when the service is no longer needed
     */
    public dispose(): void {
        // Close peer connection if exists
        if (this.peerConnection) {
            this.peerConnection.close();
        }

        // Stop all tracks in local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => track.stop());
        }

        // Clear video elements
        this.localVideoEl.srcObject = null;
        this.remoteVideoEl.srcObject = null;

        // Leave the Echo channel
        this.echo.leave(this.channelName);
    }
}
