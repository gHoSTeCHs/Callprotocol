import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { contactsData, recentCallsData } from '@/constants/data';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, CallType, Contact, ContactStatus } from '@/types';
import { Head } from '@inertiajs/react';
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, MoreHorizontal, Phone, PhoneOff, User, UserPlus, Video, VideoOff } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {  Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Dialog,  DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Contact',
        href: '/contact',
    },
];
const ContactPage = () => {
    const [contacts, setContacts] = useState<Contact[]>(contactsData);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [isCallActive, setIsCallActive] = useState<boolean>(false);
    const [callType, setCallType] = useState<CallType>(null);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [isVideoOff, setIsVideoOff] = useState<boolean>(false);

    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);


    const filteredContacts = contacts.filter(contact =>
        contact.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const startCall = (contact: Contact, type: 'audio' | 'video'): void => {
        setSelectedContact(contact);
        setCallType(type);
        setIsCallActive(true);


        if (type === "video") {

            setTimeout(() => {
                if (localVideoRef.current) {
                    localVideoRef.current.poster = "https://placehold.co/640x480";
                }

                setTimeout(() => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.poster = "https://placehold.co/640x480";
                    }
                }, 2000);
            }, 500);
        }
    };

    const endCall = (): void => {
        setIsCallActive(false);
        setCallType(null);
        setIsMuted(false);
        setIsVideoOff(false);
    };


    const getStatusColor = (status: ContactStatus): string => {
        switch (status) {
            case 'online': return 'bg-green-500';
            case 'busy': return 'bg-red-500';
            case 'away': return 'bg-yellow-500';
            case 'offline': return 'bg-gray-400';
            default: return 'bg-gray-400';
        }
    };


    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Contacts" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">

                <header className="px-6 py-4 bg-background border-b">
                    <div className="flex justify-between items-center">
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
                    <div className="w-80 border-r bg-background flex flex-col">
                        <div className="p-4">
                            <Input
                                placeholder="Search contacts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="mb-4"
                            />

                            <Tabs defaultValue="all">
                                <TabsList className="w-full mb-4">
                                    <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                                    <TabsTrigger value="favorites" className="flex-1">Favorites</TabsTrigger>
                                    <TabsTrigger value="recent" className="flex-1">Recent</TabsTrigger>
                                </TabsList>

                                <TabsContent value="all" className="m-0">
                                    <div className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
                                        {filteredContacts.map(contact => (
                                            <div
                                                key={contact.id}
                                                className="flex items-center p-3 rounded-md hover:bg-current/10 cursor-pointer"
                                                onClick={() => setSelectedContact(contact)}
                                            >
                                                <div className="relative">
                                                    <Avatar>
                                                        <AvatarImage src={contact.avatar} alt={contact.name} />
                                                        <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <span
                                                        className={`absolute bottom-0 right-0 rounded-full w-3 h-3 border-2 border-white ${getStatusColor(contact.status)}`} />
                                                </div>
                                                <div className="ml-3 flex-1">
                                                    <div className="font-medium">{contact.name}</div>
                                                    <div
                                                        className="text-xs text-gray-500">{contact.status === 'online' ? 'Online' : `Last seen ${contact.lastSeen}`}</div>
                                                </div>
                                                {contact.favorite &&
                                                    <Badge variant="outline" className="ml-2">★</Badge>}
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>

                                <TabsContent value="favorites" className="m-0">
                                    <div className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
                                        {filteredContacts.filter(c => c.favorite).map(contact => (
                                            <div
                                                key={contact.id}
                                                className="flex items-center p-3 rounded-md hover:bg-current/10 cursor-pointer"
                                                onClick={() => setSelectedContact(contact)}
                                            >
                                                <Avatar>
                                                    <AvatarImage src={contact.avatar} alt={contact.name} />
                                                    <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div className="ml-3 flex-1">
                                                    <div className="font-medium">{contact.name}</div>
                                                    <div
                                                        className="text-xs text-gray-500">{contact.status === 'online' ? 'Online' : `Last seen ${contact.lastSeen}`}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>

                                <TabsContent value="recent" className="m-0">
                                    <div className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
                                        {recentCallsData.map(call => (
                                            <div
                                                key={call.id}
                                                className="flex items-center p-3 rounded-md hover:bg-current/10 cursor-pointer"
                                                onClick={() => {
                                                    const contact = contactsData.find(c => c.name === call.name);
                                                    if (contact) setSelectedContact(contact);
                                                }}
                                            >
                                                <Avatar>
                                                    <AvatarImage src={call.avatar} alt={call.name} />
                                                    <AvatarFallback>{call.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div className="ml-3 flex-1">
                                                    <div className="font-medium">{call.name}</div>
                                                    <div className="text-xs flex items-center">
                                                        {call.type === "audio" ? <Phone size={12} className="mr-1" /> :
                                                            <Video size={12} className="mr-1" />}
                                                        <span
                                                            className={call.missed ? "text-red-500" : "text-gray-500"}>
                            {call.missed ? "Missed" : ""} {call.time}
                          </span>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const contact = contactsData.find(c => c.name === call.name);
                                                        if (contact) startCall(contact, call.type);
                                                    }}
                                                >
                                                    {call.type === "audio" ? <Phone size={16} /> : <Video size={16} />}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 p-6 overflow-auto">
                        {selectedContact ? (
                            <div className="max-w-2xl mx-auto">
                                <Card>
                                    <CardContent className="p-6">
                                        <div className="flex flex-col items-center mb-6">
                                            <Avatar className="h-24 w-24 mb-4">
                                                <AvatarImage src={selectedContact.avatar} alt={selectedContact.name} />
                                                <AvatarFallback
                                                    className="text-2xl">{selectedContact.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <h2 className="text-2xl font-bold">{selectedContact.name}</h2>
                                            <div className="flex items-center mt-1">
                                                <span
                                                    className={`inline-block rounded-full w-2 h-2 mr-2 ${getStatusColor(selectedContact.status)}`} />
                                                <span className="text-sm text-gray-500">
                        {selectedContact.status === 'online' ? 'Online' : `Last seen ${selectedContact.lastSeen}`}
                      </span>
                                            </div>
                                        </div>

                                        <div className="flex justify-center gap-4 mb-8">
                                            <Button
                                                variant="outline"
                                                className="rounded-full h-12 w-12 p-0"
                                                onClick={() => startCall(selectedContact, "audio")}
                                            >
                                                <Phone />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="rounded-full h-12 w-12 p-0"
                                                onClick={() => startCall(selectedContact, "video")}
                                            >
                                                <Video />
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" className="rounded-full h-12 w-12 p-0">
                                                        <MoreHorizontal />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem>
                                                        Edit Contact
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-red-500">
                                                        Remove Contact
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium text-gray-500">Email</div>
                                                <div
                                                    className="text-sm">{selectedContact.name.split(' ')[0].toLowerCase()}@example.com
                                                </div>
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
                            <div className="h-full flex items-center justify-center flex-col text-gray-500">
                                <User size={64} className="mb-4 text-gray-300" />
                                <p>Select a contact to view details</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Call Dialog */}
                <Dialog open={isCallActive} onOpenChange={(value) => !value && endCall()}>
                    <DialogContent className={callType === "video" ? "sm:max-w-xl" : "sm:max-w-md"}>
                        <DialogHeader>
                            <DialogTitle>{callType === "video" ? "Video Call" : "Audio Call"} with {selectedContact?.name}</DialogTitle>
                            <DialogDescription>
                                {callType === "video" ? "Camera and microphone are active" : "Microphone is active"}
                            </DialogDescription>
                        </DialogHeader>

                        {callType === "video" ? (
                            <div className="relative mb-4 bg-gray-900 rounded-lg overflow-hidden aspect-video">
                                <video
                                    ref={remoteVideoRef}
                                    className="w-full h-full object-cover"
                                    poster="https://placehold.co/640x360"
                                    autoPlay
                                    playsInline
                                />
                                <div
                                    className="absolute bottom-4 right-4 w-32 h-32 bg-gray-800 rounded-lg overflow-hidden border-2 border-white">
                                    <video
                                        ref={localVideoRef}
                                        className="w-full h-full object-cover"
                                        poster="https://placehold.co/160x160"
                                        autoPlay
                                        playsInline
                                        muted
                                    />
                                    {isVideoOff && (
                                        <div
                                            className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-70">
                                            <VideoOff size={24} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 flex justify-center">
                                <Avatar className="h-32 w-32">
                                    <AvatarImage src={selectedContact?.avatar} alt={selectedContact?.name} />
                                    <AvatarFallback
                                        className="text-4xl">{selectedContact?.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                            </div>
                        )}

                        <DialogFooter className="flex justify-center gap-4 mt-4">
                            <Button
                                variant="outline"
                                size="icon"
                                className="rounded-full h-12 w-12"
                                onClick={() => setIsMuted(!isMuted)}
                            >
                                {isMuted ? <MicOff /> : <Mic />}
                            </Button>
                            {callType === "video" && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="rounded-full h-12 w-12"
                                    onClick={() => setIsVideoOff(!isVideoOff)}
                                >
                                    {isVideoOff ? <VideoOff /> : <Video />}
                                </Button>
                            )}
                            <Button
                                variant="destructive"
                                size="icon"
                                className="rounded-full h-12 w-12"
                                onClick={endCall}
                            >
                                {callType === "video" ? <VideoOff /> : <PhoneOff />}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
};

export default ContactPage;
