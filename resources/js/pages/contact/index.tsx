import IncomingCallDialog from '@/components/incoming-call';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { contactsData, recentCallsData } from '@/constants/data';
import { WebRTCService } from '@/services/webrtcService';

import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, CallType, Contact, ContactStatus, SharedData } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import { Mic, MicOff, MoreHorizontal, Phone, PhoneOff, User, UserPlus, Video, VideoOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

declare global {
    interface Window {
        // ts-ignore
        Echo: any;
        userId: number;
    }
}

interface IncomingCallData {
    call_id: number;
    type: 'audio' | 'video';
    caller: {
        id: number;
        name: string;
        avatar: string;
    };
}

interface CallStatusData {
    call_id: number;
    status: 'accepted' | 'rejected' | 'ended';
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Contact',
        href: '/contact',
    },
];
const ContactPage = ({ userContacts }: { userContacts: Contact[] }) => {
    const { auth } = usePage<SharedData>().props;

    const [contacts, setContacts] = useState<Contact[]>(userContacts);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [isCallActive, setIsCallActive] = useState<boolean>(false);
    const [callType, setCallType] = useState<CallType>(null);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [isVideoOff, setIsVideoOff] = useState<boolean>(false);

    const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
    const [activeCallId, setActiveCallId] = useState<number | null>(null);
    const [isInitiatingCall, setIsInitiatingCall] = useState<boolean>(false);

    // Refs to access current state in event listeners
    const isInitiatingCallRef = useRef<boolean>(false);
    const isCallActiveRef = useRef<boolean>(false);
    const incomingCallRef = useRef<IncomingCallData | null>(null);
    const selectedContactRef = useRef<Contact | null>(null);
    const activeCallIdRef = useRef<number | null>(null);

    // Update refs when state changes
    useEffect(() => {
        isInitiatingCallRef.current = isInitiatingCall;
    }, [isInitiatingCall]);

    useEffect(() => {
        isCallActiveRef.current = isCallActive;
    }, [isCallActive]);

    useEffect(() => {
        incomingCallRef.current = incomingCall;
    }, [incomingCall]);

    useEffect(() => {
        selectedContactRef.current = selectedContact;
    }, [selectedContact]);

    useEffect(() => {
        activeCallIdRef.current = activeCallId;
    }, [activeCallId]);

    const webRTCServiceRef = useRef<WebRTCService | null>(null);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

    const filteredContacts = contacts.filter((contact) => contact.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleSignalingMessage = async (message: any) => {
        try {
            await axios.post('/signaling', {
                receiver_id: selectedContactRef.current?.id,
                call_id: activeCallIdRef.current,
                signal: message,
            });
        } catch (error) {
            console.error('Failed to send signaling message:', error);
        }
    };

    const checkMediaPermissions = async () => {
        try {
            const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
            console.log('Camera permission status:', permissions.state);
            return permissions.state === 'granted';
        } catch (error) {
            console.error('Error checking camera permissions:', error);
            return false;
        }
    };

    // Set up event listeners only once when component mounts
    useEffect(() => {
        const userId = auth.user.id;

        if (!window.Echo) {
            console.error('Echo is not initialized!');
            return;
        }

        const channel = window.Echo.private(`user.${userId}`);

        // Listen for incoming calls
        channel.listen('IncomingCall', (data: IncomingCallData) => {
            console.log('Incoming call event received:', data);
            setIncomingCall(data);
        });

        console.log('Video container dimensions:', {
            width: remoteVideoRef.current?.parentElement?.clientWidth,
            height: remoteVideoRef.current?.parentElement?.clientHeight,
        });

        channel.listen('CallStatusChanged', (data: CallStatusData) => {
            console.log('Call status changed event received:', data);

            if (data.status === 'accepted') {
                if (isInitiatingCallRef.current) {
                    setIsInitiatingCall(false);
                    setIsCallActive(true);
                    setActiveCallId(data.call_id);

                    initializeWebRTC(true).catch((error) => {
                        console.error('Failed to initialize WebRTC after call acceptance:', error);
                        resetCallState();
                    });
                }
            } else if (data.status === 'rejected' || data.status === 'ended') {
                if (isInitiatingCallRef.current || isCallActiveRef.current) {
                    resetCallState();
                }

                if (incomingCallRef.current && incomingCallRef.current.call_id === data.call_id) {
                    setIncomingCall(null);
                }
            }
        });

        channel.listen('WebRTCSignal', (data: any) => {
            console.log('WebRTC signal received:', data);
            console.log('Signal type:', data.signal.type);

            if (data.signal.type === 'offer' || data.signal.type === 'answer') {
                console.log('Signal contains sdp:', typeof data.signal.sdp);
                if (data.signal.sdp && typeof data.signal.sdp === 'string') {
                    console.log('SDP contains video codecs:', data.signal.sdp.includes('video'));
                } else if (data.signal.sdp) {
                    console.log('SDP is present but not a string:', typeof data.signal.sdp);
                } else {
                    console.log('No SDP found in signal');
                }
            }

            if (!webRTCServiceRef.current) {
                console.warn('WebRTC service not initialized when signal received');
                return;
            }

            const signal = data.signal;

            try {
                if (signal.type === 'offer') {
                    webRTCServiceRef.current.handleIncomingCall(signal).catch((error) => {
                        console.error('Error handling incoming call offer:', error);
                    });
                } else if (signal.type === 'answer') {
                    webRTCServiceRef.current.handleAnswer(signal).catch((error) => {
                        console.error('Error handling call answer:', error);
                    });
                } else if (signal.type === 'candidate') {
                    webRTCServiceRef.current.handleIceCandidate(signal.candidate).catch((error) => {
                        console.error('Error handling ICE candidate:', error);
                    });
                } else {
                    console.warn('Unknown signal type received:', signal.type);
                }
            } catch (error) {
                console.error('Error processing WebRTC signal:', error);
            }
        });

        // Cleanup function runs when component unmounts
        return () => {
            console.log('Cleaning up Echo listeners');
            channel.stopListening('IncomingCall');
            channel.stopListening('CallStatusChanged');
            channel.stopListening('WebRTCSignal');
        };
    }, [auth.user.id]);

    // Initialize WebRTC
    const initializeWebRTC = async (isInitiator: boolean) => {
        console.log(`Initializing WebRTC as ${isInitiator ? 'initiator' : 'receiver'} for call type: ${callType}`);

        if (!webRTCServiceRef.current) {
            webRTCServiceRef.current = new WebRTCService(handleSignalingMessage);
        }

        try {
            const enableVideo = callType === 'video';
            console.log(`Requesting local stream with video: ${enableVideo}`);
            const localStream = await webRTCServiceRef.current.startLocalStream(enableVideo);

            if (localStream) {
                console.log('Local stream obtained with:');
                console.log('- Video tracks:', localStream.getVideoTracks().length);
                console.log('- Audio tracks:', localStream.getAudioTracks().length);
            }

            if (localVideoRef.current && localStream) {
                console.log('Setting local video source');
                localVideoRef.current.srcObject = localStream;
            }

            webRTCServiceRef.current.setRemoteStreamCallback((remoteStream) => {
                console.log('Remote stream received with:');
                console.log('- Video tracks:', remoteStream.getVideoTracks().length);
                console.log('- Audio tracks:', remoteStream.getAudioTracks().length);
                console.log('- Video track enabled:', remoteStream.getVideoTracks()[0]?.enabled);

                if (remoteVideoRef.current) {
                    console.log('Setting remote video source');
                    remoteVideoRef.current.srcObject = remoteStream;

                    remoteVideoRef.current.load();
                }
            });

            if (isInitiator) {
                console.log('Creating and sending offer');
                await webRTCServiceRef.current.initiateCall();
            }
        } catch (error) {
            console.error('Failed to initialize WebRTC:', error);
            resetCallState();
            throw error;
        }
    };

    const resetCallState = () => {
        console.log('Resetting call state');
        if (webRTCServiceRef.current) {
            webRTCServiceRef.current.disconnect();
            webRTCServiceRef.current = null;
        }

        setIsCallActive(false);
        setCallType(null);
        setIsMuted(false);
        setIsVideoOff(false);
        setActiveCallId(null);
        setIsInitiatingCall(false);

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }

        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
    };

    const startCall = async (contact: Contact, type: 'audio' | 'video'): Promise<void> => {
        console.log(`Starting ${type} call with ${contact.name}`);
        setIsInitiatingCall(true);
        setSelectedContact(contact);
        setCallType(type);

        if (callType === 'video') {
            const hasVideoPermission = await checkMediaPermissions();
            if (!hasVideoPermission) {
                console.warn('Camera permissions not granted, video may not work');
            }
        }

        try {
            const response = await axios.post('/calls', {
                receiver_id: contact.id,
                type: type,
            });

            console.log('Call initiated successfully:', response.data);
            setActiveCallId(response.data.call_id);
        } catch (error) {
            console.error('Failed to initiate call:', error);
            resetCallState();
        }
    };

    const endCall = async (): Promise<void> => {
        console.log('Ending call');
        if (activeCallId) {
            try {
                await axios.patch(`/calls/${activeCallId}`, {
                    status: 'ended',
                });
            } catch (error) {
                console.error('Failed to end call:', error);
            }
        }

        resetCallState();
    };

    const toggleMute = (): void => {
        setIsMuted(!isMuted);
        if (webRTCServiceRef.current) {
            webRTCServiceRef.current.toggleMute(!isMuted);
        }
    };

    const toggleVideo = (): void => {
        setIsVideoOff(!isVideoOff);
        if (webRTCServiceRef.current) {
            webRTCServiceRef.current.toggleVideo(!isVideoOff);
        }
    };

    const handleAcceptIncomingCall = () => {
        if (!incomingCall) return;

        console.log('Accepting incoming call:', incomingCall);

        const caller = contacts.find((c) => c.id === incomingCall.caller.id) || {
            id: incomingCall.caller.id,
            name: incomingCall.caller.name,
            avatar: incomingCall.caller.avatar,
            status: 'online' as ContactStatus,
            lastSeen: 'just now',
            favorite: false,
        };

        setSelectedContact(caller);
        setCallType(incomingCall.type);
        setIsCallActive(true);
        setActiveCallId(incomingCall.call_id);
        setIncomingCall(null);

        // Initialize WebRTC as receiver
        initializeWebRTC(false).catch((error) => {
            console.error('Failed to initialize WebRTC when accepting call:', error);
            resetCallState();
        });
    };

    const handleRejectIncomingCall = async () => {
        if (!incomingCall) return;

        console.log('Rejecting incoming call:', incomingCall);

        try {
            await axios.patch(`/calls/${incomingCall.call_id}`, {
                status: 'rejected',
            });
        } catch (error) {
            console.error('Failed to reject call:', error);
        }

        setIncomingCall(null);
    };

    useEffect(() => {
        if (webRTCServiceRef.current && callType === 'video') {
            webRTCServiceRef.current.ensureVideoEnabled();
        }

        if (remoteVideoRef.current) {
            remoteVideoRef.current.onloadedmetadata = () => {
                console.log('Remote video dimensions:', {
                    videoWidth: remoteVideoRef.current?.videoWidth,
                    videoHeight: remoteVideoRef.current?.videoHeight,
                });
                remoteVideoRef.current?.play().catch((e) => console.error('Error playing video:', e));
            };
        }

        if (localVideoRef.current) {
            console.log('Setting up local video element');
            localVideoRef.current.onloadedmetadata = () => {
                console.log('Local video metadata loaded');
                localVideoRef.current?.play().catch((e) => console.error('Error playing local video:', e));
            };
        }

        if (remoteVideoRef.current) {
            console.log('Setting up remote video element');
            remoteVideoRef.current.onloadedmetadata = () => {
                console.log('Remote video metadata loaded');
                remoteVideoRef.current?.play().catch((e) => console.error('Error playing remote video:', e));
            };
        }
    }, [isCallActive]);

    const getStatusColor = (status: ContactStatus): string => {
        switch (status) {
            case 'online':
                return 'bg-green-500';
            case 'busy':
                return 'bg-red-500';
            case 'away':
                return 'bg-yellow-500';
            case 'offline':
                return 'bg-gray-400';
            default:
                return 'bg-gray-400';
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Contacts" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <header className="bg-background border-b px-6 py-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold">Contacts</h1>
                        <div className="flex gap-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" size="icon">
                                            <UserPlus size={18} />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Add Contact</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className="bg-background flex w-80 flex-col border-r">
                        <div className="p-4">
                            <Input
                                placeholder="Search contacts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="mb-4"
                            />

                            <Tabs defaultValue="all">
                                <TabsList className="mb-4 w-full">
                                    <TabsTrigger value="all" className="flex-1">
                                        All
                                    </TabsTrigger>
                                    <TabsTrigger value="favorites" className="flex-1">
                                        Favorites
                                    </TabsTrigger>
                                    <TabsTrigger value="recent" className="flex-1">
                                        Recent
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="all" className="m-0">
                                    <div className="max-h-[calc(100vh-220px)] space-y-1 overflow-y-auto pr-2">
                                        {filteredContacts.map((contact) => (
                                            <div
                                                key={contact.id}
                                                className="flex cursor-pointer items-center rounded-md p-3 hover:bg-current/10"
                                                onClick={() => setSelectedContact(contact)}
                                            >
                                                <div className="relative">
                                                    <Avatar>
                                                        <AvatarImage src={contact.avatar} alt={contact.name} />
                                                        <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <span
                                                        className={`absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-white ${getStatusColor(contact.status)}`}
                                                    />
                                                </div>
                                                <div className="ml-3 flex-1">
                                                    <div className="font-medium">{contact.name}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {contact.status === 'online' ? 'Online' : `Last seen ${contact.lastSeen}`}
                                                    </div>
                                                </div>
                                                {contact.favorite && (
                                                    <Badge variant="outline" className="ml-2">
                                                        ★
                                                    </Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>

                                <TabsContent value="favorites" className="m-0">
                                    <div className="max-h-[calc(100vh-220px)] space-y-1 overflow-y-auto pr-2">
                                        {filteredContacts
                                            .filter((c) => c.favorite)
                                            .map((contact) => (
                                                <div
                                                    key={contact.id}
                                                    className="flex cursor-pointer items-center rounded-md p-3 hover:bg-current/10"
                                                    onClick={() => setSelectedContact(contact)}
                                                >
                                                    <Avatar>
                                                        <AvatarImage src={contact.avatar} alt={contact.name} />
                                                        <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="ml-3 flex-1">
                                                        <div className="font-medium">{contact.name}</div>
                                                        <div className="text-xs text-gray-500">
                                                            {contact.status === 'online' ? 'Online' : `Last seen ${contact.lastSeen}`}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </TabsContent>

                                <TabsContent value="recent" className="m-0">
                                    <div className="max-h-[calc(100vh-220px)] space-y-1 overflow-y-auto pr-2">
                                        {recentCallsData.map((call) => (
                                            <div
                                                key={call.id}
                                                className="flex cursor-pointer items-center rounded-md p-3 hover:bg-current/10"
                                                onClick={() => {
                                                    const contact = contactsData.find((c) => c.name === call.name);
                                                    if (contact) setSelectedContact(contact);
                                                }}
                                            >
                                                <Avatar>
                                                    <AvatarImage src={call.avatar} alt={call.name} />
                                                    <AvatarFallback>{call.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div className="ml-3 flex-1">
                                                    <div className="font-medium">{call.name}</div>
                                                    <div className="flex items-center text-xs">
                                                        {call.type === 'audio' ? (
                                                            <Phone size={12} className="mr-1" />
                                                        ) : (
                                                            <Video size={12} className="mr-1" />
                                                        )}
                                                        <span className={call.missed ? 'text-red-500' : 'text-gray-500'}>
                                                            {call.missed ? 'Missed' : ''} {call.time}
                                                        </span>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const contact = contactsData.find((c) => c.name === call.name);
                                                        if (contact) startCall(contact, call.type).then();
                                                    }}
                                                >
                                                    {call.type === 'audio' ? <Phone size={16} /> : <Video size={16} />}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 overflow-auto p-6">
                        {selectedContact ? (
                            <div className="mx-auto max-w-2xl">
                                <Card>
                                    <CardContent className="p-6">
                                        <div className="mb-6 flex flex-col items-center">
                                            <Avatar className="mb-4 h-24 w-24">
                                                <AvatarImage src={selectedContact.avatar} alt={selectedContact.name} />
                                                <AvatarFallback className="text-2xl">{selectedContact.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <h2 className="text-2xl font-bold">{selectedContact.name}</h2>
                                            <div className="mt-1 flex items-center">
                                                <span
                                                    className={`mr-2 inline-block h-2 w-2 rounded-full ${getStatusColor(selectedContact.status)}`}
                                                />
                                                <span className="text-sm text-gray-500">
                                                    {selectedContact.status === 'online' ? 'Online' : `Last seen ${selectedContact.lastSeen}`}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mb-8 flex justify-center gap-4">
                                            <Button
                                                variant="outline"
                                                className="h-12 w-12 rounded-full p-0"
                                                onClick={() => startCall(selectedContact, 'audio')}
                                            >
                                                <Phone />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="h-12 w-12 rounded-full p-0"
                                                onClick={() => startCall(selectedContact, 'video')}
                                            >
                                                <Video />
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" className="h-12 w-12 rounded-full p-0">
                                                        <MoreHorizontal />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem>Edit Contact</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-red-500">Remove Contact</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium text-gray-500">Email</div>
                                                <div className="text-sm">{selectedContact.name.split(' ')[0].toLowerCase()}@example.com</div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium text-gray-500">Phone</div>
                                                <div className="text-sm">+1 (555) 123-4567</div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium text-gray-500">Department</div>
                                                <div className="text-sm">Marketing</div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium text-gray-500">Location</div>
                                                <div className="text-sm">New York Office</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center text-gray-500">
                                <User size={64} className="mb-4 text-gray-300" />
                                <p>Select a contact to view details</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Incoming Call Dialog */}
                {incomingCall && (
                    <IncomingCallDialog
                        callId={incomingCall.call_id}
                        callerId={incomingCall.caller.id}
                        callerName={incomingCall.caller.name}
                        callerAvatar={incomingCall.caller.avatar}
                        callType={incomingCall.type}
                        onAccept={handleAcceptIncomingCall}
                        onReject={handleRejectIncomingCall}
                    />
                )}

                {/* Call Dialog */}
                <Dialog open={isCallActive} onOpenChange={(value) => !value && endCall()}>
                    <DialogContent className={callType === 'video' ? 'sm:max-w-xl' : 'sm:max-w-md'}>
                        <DialogHeader>
                            <DialogTitle>
                                {callType === 'video' ? 'Video Call' : 'Audio Call'} with {selectedContact?.name}
                            </DialogTitle>
                            <DialogDescription>
                                {callType === 'video' ? 'Camera and microphone are active' : 'Microphone is active'}
                            </DialogDescription>
                        </DialogHeader>

                        {callType === 'video' ? (
                            <div className="relative mb-4 aspect-video overflow-hidden rounded-lg bg-gray-900">
                                <video ref={remoteVideoRef} className="h-full w-full object-cover" autoPlay playsInline />
                                <div className="absolute right-4 bottom-4 h-32 w-32 overflow-hidden rounded-lg border-2 border-white bg-gray-800">
                                    <video
                                        ref={remoteVideoRef}
                                        className="h-full w-full object-cover"
                                        autoPlay
                                        playsInline
                                        muted={false}
                                        style={{ backgroundColor: '#000' }}
                                    />
                                    {callType === 'video' && (
                                        <div className="bg-opacity-50 absolute inset-0 flex items-center justify-center bg-black text-white">
                                            {!remoteVideoRef.current?.srcObject ? 'Connecting video...' : ''}
                                        </div>
                                    )}

                                    {isVideoOff && (
                                        <div className="bg-opacity-70 absolute inset-0 flex items-center justify-center bg-gray-900">
                                            <VideoOff size={24} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-center py-8">
                                <Avatar className="h-32 w-32">
                                    <AvatarImage src={selectedContact?.avatar} alt={selectedContact?.name} />
                                    <AvatarFallback className="text-4xl">{selectedContact?.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                            </div>
                        )}

                        <DialogFooter className="mt-4 flex justify-center gap-4">
                            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={toggleMute}>
                                {isMuted ? <MicOff /> : <Mic />}
                            </Button>
                            {callType === 'video' && (
                                <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={toggleVideo}>
                                    {isVideoOff ? <VideoOff /> : <Video />}
                                </Button>
                            )}
                            <Button variant="destructive" size="icon" className="h-12 w-12 rounded-full" onClick={endCall}>
                                {callType === 'video' ? <VideoOff /> : <PhoneOff />}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={isInitiatingCall} onOpenChange={(value) => !value && endCall()}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Calling {selectedContact?.name}...</DialogTitle>
                        </DialogHeader>
                        <div className="flex justify-center py-8">
                            <Avatar className="h-32 w-32">
                                <AvatarImage src={selectedContact?.avatar} alt={selectedContact?.name} />
                                <AvatarFallback className="text-4xl">{selectedContact?.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                        </div>
                        <DialogFooter className="mt-4 flex justify-center">
                            <Button variant="destructive" size="icon" className="h-12 w-12 rounded-full" onClick={endCall}>
                                <PhoneOff />
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
};

export default ContactPage;
