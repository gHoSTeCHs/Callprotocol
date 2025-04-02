<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class WebRTCSignal implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $callId;
    public $receiverId;
    public $senderId;
    public $signal;

    public function __construct($callId, $receiverId, $senderId, $signal)
    {
        $this->callId = $callId;
        $this->receiverId = $receiverId;
        $this->senderId = $senderId;
        $this->signal = $signal;
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('user.' . $this->receiverId);
    }

    public function broadcastWith(): array
    {
        return [
            'call_id' => $this->callId,
            'sender_id' => $this->senderId,
            'signal' => $this->signal,
        ];
    }
}
