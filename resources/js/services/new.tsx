
import { Head, } from '@inertiajs/react';
import axios from 'axios';
import Peer from 'peerjs'
import { useEffect, useRef, useState } from 'react';

export default function Contacts({ auth, users }) {

    const [selectedUser, setSelectedUser] = useState(null)
    const [peer, setPeer] = useState(new Peer())
    const [peerCall,  setPeerCall] = useState(null)

    const remoteVideoRef = useRef(null);
    const localVideoRef = useRef(null)
    const [isCalling, setIsCalling] = useState(false)
    const localStreamRef = useRef(null)

    const selectedUserRef = useRef(null)

    useEffect(()=>{
        selectedUserRef.current = selectedUser
    },[selectedUser])

    const callUser = () => {
        let payload = {
            peerId: peer.id
        }
        axios.post(`/video-call/request/${selectedUserRef.current.id}`, payload);
        setIsCalling(true)
        displayLocalVideo();
    }

    const endCall = () => {
        peerCall.close();
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localVideoRef.current = null
        remoteVideoRef.current = null
        setIsCalling(false)
    }

    const displayLocalVideo = () => {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then((stream) => {
                localVideoRef.current.srcObject = stream
                localStreamRef.current = stream
            })
            .catch((err) => {
                console.error('Error accessing media devices:', err);
            });
    }

    const recipientAcceptCall = (e) => {

        // send signal that recipient accept the call
        axios.post(`/video-call/request/status/${e.user.fromUser.id}`, { peerId: peer.id, status: 'accept'});

        // stand by for callers connection
        peer.on('call', (call) => {
            // will be used when ending a call
            setPeerCall(call)
            // accept call if the caller is the one that you accepted
            if(e.user.peerId == call.peer) {
                // Prompt user to allow media devices
                navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                    .then((stream) => {

                        // Answer the call with your stream
                        call.answer(stream);
                        // Listen for the caller's stream
                        call.on('stream', (remoteStream) => {
                            remoteVideoRef.current.srcObject = remoteStream
                        });

                        // caller end the call
                        call.on('close', () => {
                            endCall()
                        });
                    })
                    .catch((err) => {
                        console.error('Error accessing media devices:', err);
                    });
            }

        });

    }

    const createConnection = (e) => {
        let receiverId = e.user.peerId
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then((stream) => {
                // Initiate the call with the receiver's ID
                const call = peer.call(receiverId, stream);
                // will be used when ending a call
                setPeerCall(call)

                // Listen for the receiver's stream
                call.on('stream', (remoteStream) => {
                    remoteVideoRef.current.srcObject = remoteStream
                });

                // receiver end the call
                call.on('close', () => {
                    endCall()
                });
            })
            .catch((err) => {
                console.error('Error accessing media devices:', err);
            });
    }

    const connectWebSocket = () => {

        // request video call
        window.Echo.private(`video-call.${auth.user.id}`).listen('RequestVideoCall',  (e) => {
            setSelectedUser(e.user.fromUser)
            setIsCalling(true)
            recipientAcceptCall(e)
            displayLocalVideo();

        });

        // video call request accepted
        window.Echo.private(`video-call.${auth.user.id}`).listen('RequestVideoCallStatus', (e) => {
            createConnection(e)
        });
    }
    useEffect(()=>{
        connectWebSocket();

        return () => {
            window.Echo.leave(`video-call.${auth.user.id}`);
        }
    },[])

    return (
        <div>
            <Head title="Contacts" />

            <div className="h-screen flex bg-gray-100" style={{height:'90vh'}}>
                {/* Sidebar */}
                <div className="w-1/4 bg-white border-r border-gray-200">
                    <div className="p-4 bg-gray-100 font-bold text-lg border-b border-gray-200">
                        Contacts
                    </div>
                    <div className="p-4 space-y-4">
                        {/* Contact List */}
                        {users.map((user, key) => (
                            <div
                                key={key}
                                onClick={()=>setSelectedUser(user)}
                                className={`flex items-center ${user.id == selectedUser?.id ? 'bg-blue-500 text-white' : ''} p-2 hover:bg-blue-500 hover:text-white rounded cursor-pointer`}
                            >
                                <div className="w-12 h-12 bg-blue-200 rounded-full"></div>
                                <div className="ml-4">
                                    <div className="font-semibold">{user.name}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Contacts Area */}
                <div className="flex flex-col w-3/4">
                    {!selectedUser &&
                        <div className=' h-full flex justify-center items-center text-gray-800 font-bold'>
                            Select Conversation
                        </div>
                    }
                    {selectedUser &&
                        <>
                            {/* Contact Header */}
                            <div className="p-4 border-b border-gray-200 flex items-center">
                                <div className="w-12 h-12 bg-blue-200 rounded-full"></div>
                                <div className="ml-4">
                                    <div className="font-bold">{selectedUser?.name}
                                        {!isCalling &&
                                            <button onClick={()=>callUser()} className="ml-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Call</button>
                                        }
                                        {isCalling &&
                                            <button onClick={()=>endCall()} className="ml-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">End Call</button>
                                        }
                                    </div>
                                </div>
                            </div>

                            {/* Contact Area */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 relative">
                                {isCalling &&
                                    <>
                                        <video id="remoteVideo" ref={remoteVideoRef} autoPlay playsInline muted className="border-2 border-gray-800 w-full"></video>
                                        <video id="localVideo" ref={localVideoRef} autoPlay playsInline muted className="m-0 border-2 border-gray-800 absolute top-6 right-6 w-4/12" style={{margin:'0'}}></video>
                                    </>
                                }
                                {!isCalling &&
                                    <div
                                        className="h-full flex justify-center items-center text-gray-800 font-bold"
                                    >
                                        No Ongoing Call.
                                    </div>
                                }
                            </div>
                        </>
                    }

                </div>
            </div>
        </div>
    );
}
