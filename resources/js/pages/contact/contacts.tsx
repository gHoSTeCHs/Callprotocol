import IncomingCallDialog from '@/components/incoming-call';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { getStatusColor } from '@/pages/contact/index';
import WebRTCManager from '@/services/webService';
import { type BreadcrumbItem, type CallType, Contact, type ContactStatus, type IncomingCallData, SharedData } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import { MoreHorizontal, Phone, User, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

declare global {
    interface Window {
        Echo: {
            private: (channel: string) => {
                listen: (event: string, callback: (data: any) => void) => void;
                stopListening: (event: string) => void;
            };
        };
    }
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Contact',
        href: '/contact',
    },
];

enum CallState {
    IDLE = 'idle',
    INITIATING = 'initiating',
    RINGING = 'ringing',
    CONNECTED = 'connected',
    ENDING = 'ending',
}

const NewContactPage = ({ userContacts }: { userContacts: Contact[] }) => {
    const { auth } = usePage<SharedData>().props;
    const [contacts, setContacts] = useState<Contact[]>(userContacts);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [callState, setCallState] = useState<CallState>(CallState.IDLE);
    const [activeCallId, setActiveCallId] = useState<number | null>(null);

    const [callType, setCallType] = useState<CallType>(null);
    const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);

    const [callError, setCallError] = useState<string | null>(null);

    const webRTCManagerRef = useRef<WebRTCManager | null>(null);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

    const startCall = async (contact: Contact, type: 'audio' | 'video'): Promise<void> => {
        if (!webRTCManagerRef.current) {
            toast('Call service not initialized. Please refresh and try again.');
            return;
        }

        setCallState(CallState.INITIATING);
        setSelectedContact(contact);
        setCallType(type);
        setCallError(null);

        try {
            const response = await axios.post('/calls', {
                receiver_id: contact.id,
                type: type,
            });

            console.log('Call initiated successfully:', response.data);
            setActiveCallId(response.data.call_id);
            setCallState(CallState.RINGING);

            webRTCManagerRef.current.callUser();
        } catch (error) {
            console.error('Failed to initiate call:', error);
            toast('Could not connect to the recipient. Please try again later.');
            resetCallState();
        }
    };

    const resetCallState = () => {
        console.log('Resetting call state');
        if (webRTCManagerRef.current) {
            webRTCManagerRef.current.disconnect();
        }

        setCallState(CallState.IDLE);
        setCallType(null);
        setActiveCallId(null);
        setCallError(null);

        if (auth?.user?.id) {
            webRTCManagerRef.current = new WebRTCManager(
                auth.user.id,
                localVideoRef,
                remoteVideoRef,
                (status: CallState) => setCallState(status),
                (error: string) => setCallError(error),
            );
        }

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }

        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
    };

    const handleAcceptIncomingCall = () => {
        if (!incomingCall) return;

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
        setCallState(CallState.CONNECTED);
        setActiveCallId(incomingCall.call_id);
        setIncomingCall(null);
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
            toast("Could not reject the call. The caller may still think you're available.");
        }

        setIncomingCall(null);
    };

    const endCall = async (): Promise<void> => {
        if (webRTCManagerRef.current) {
            webRTCManagerRef.current.endCall();
        }

        if (activeCallId) {
            try {
                await axios.patch(`/calls/${activeCallId}`, {
                    status: 'ended',
                });
            } catch (error) {
                console.error('Failed to end call:', error);
                toast('Call ended locally but server notification failed.');
            }
        }

        resetCallState();
    };

    useEffect(() => {
        if (auth?.user?.id) {
            webRTCManagerRef.current = new WebRTCManager(
                auth.user.id,
                localVideoRef,
                remoteVideoRef,
                (status: CallState) => setCallState(status),
                (error: string) => {
                    setCallError(error);
                    toast('Error connecting to user');
                },
            );
        }

        return () => {
            if (webRTCManagerRef.current) {
                webRTCManagerRef.current.disconnect();
                webRTCManagerRef.current = null;
            }
        };
    }, [auth?.user?.id]);

    useEffect(() => {
        if (webRTCManagerRef.current && selectedContact) {
            webRTCManagerRef.current.setSelectedUser(selectedContact);
        }
    }, [selectedContact]);

    useEffect(() => {
        const userId = auth?.user?.id;
        if (!userId) return;

        if (!window.Echo) {
            console.error('Echo is not initialized!');
            toast('Real-time communication service is unavailable.');
            return;
        }

        const channel = window.Echo.private(`user.${userId}`);

        let isMounted = true;

        channel.listen('IncomingCall', (data: IncomingCallData) => {
            console.log('Incoming call event received:', data);
            if (isMounted) {
                setIncomingCall(data);
            }
        });

        return () => {
            isMounted = false;

            channel.stopListening('IncomingCall');
        };
    }, [auth?.user?.id]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={'Contact Page'} />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="flex flex-1 overflow-hidden">
                    <div className="bg-background flex w-80 flex-col border-r">
                        <div className="p-4">
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
                                        {userContacts.map((contact) => (
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
                            </Tabs>
                        </div>
                    </div>
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
                                                // disabled={CallState.INITIATING || CallState.CONNECTED}
                                            >
                                                <Phone />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="h-12 w-12 rounded-full p-0"
                                                onClick={() => startCall(selectedContact, 'video')}
                                                // disabled={CallState.CONNECTED || CallState.INITIATING}
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
            </div>

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

            {/* Video Call Dialog */}
            <Dialog open={callState === CallState.CONNECTED} onOpenChange={(open) => !open && endCall()}>
                <DialogContent className="max-w-3xl p-0">
                    <div className="flex flex-col gap-4 p-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold">{selectedContact && `Call with ${selectedContact.name}`}</h2>
                            <Button variant="destructive" onClick={endCall}>
                                End Call
                            </Button>
                        </div>

                        {callError && (
                            <div className="relative mb-2 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
                                <span className="block sm:inline">{callError}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative h-64 overflow-hidden rounded-md bg-gray-100">
                                <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
                                <div className="absolute right-2 bottom-2 rounded bg-black/70 px-2 py-1 text-sm text-white">
                                    {selectedContact?.name || 'Remote'}
                                </div>
                            </div>

                            <div className="relative h-64 overflow-hidden rounded-md bg-gray-100">
                                <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                                <div className="absolute right-2 bottom-2 rounded bg-black/70 px-2 py-1 text-sm text-white">You</div>
                            </div>
                        </div>

                        {/*{isInitiatingCall && !isCallActive && (*/}
                        {/*    <div className="my-2 text-center text-gray-500">Calling {selectedContact?.name}...</div>*/}
                        {/*)}*/}
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
};

export default NewContactPage;
