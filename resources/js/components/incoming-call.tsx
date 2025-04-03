import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import axios from 'axios';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useState } from 'react';
import { IncomingCallDialogProps } from '@/types';

const IncomingCallDialog = ({ callId, callerId, callerName, callerAvatar, callType, onAccept, onReject }: IncomingCallDialogProps) => {
    const [isProcessing, setIsProcessing] = useState(false);

    const handleAccept = async () => {
        setIsProcessing(true);
        try {
            await axios.patch(`/calls/${callId}`, { status: 'accepted' });
            onAccept();
        } catch (error) {
            console.error('Failed to accept call:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        setIsProcessing(true);
        try {
            await axios.patch(`/calls/${callId}`, { status: 'rejected' });
            onReject();
        } catch (error) {
            console.error('Failed to reject call:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={true}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Incoming {callType === 'video' ? 'Video' : 'Audio'} Call</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center py-4">
                    <Avatar className="mb-4 h-24 w-24">
                        <AvatarImage src={callerAvatar} alt={callerName} />
                        <AvatarFallback className="text-2xl">{callerName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <h2 className="mb-6 text-xl font-semibold">{callerName}</h2>

                    <div className="flex justify-center gap-4">
                        <Button variant="destructive" size="icon" className="h-12 w-12 rounded-full" onClick={handleReject} disabled={isProcessing}>
                            <PhoneOff />
                        </Button>
                        <Button
                            variant="default"
                            size="icon"
                            className="h-12 w-12 rounded-full bg-green-500 hover:bg-green-600"
                            onClick={handleAccept}
                            disabled={isProcessing}
                        >
                            {callType === 'video' ? <Video /> : <Phone />}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default IncomingCallDialog;
