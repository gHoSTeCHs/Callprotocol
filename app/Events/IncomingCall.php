<?php

namespace App\Events;

use App\Models\Call;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class IncomingCall implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Call $call;
    public User $caller;
    public User $receiver;

    public function __construct(Call $call, $caller, User $receiver)
    {
        $this->call = $call;
        $this->caller = $caller;
        $this->receiver = $receiver;
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('user.' . $this->receiver->id);
    }

    public function broadcastWith(): array
    {
        return [
            'call_id' => $this->call->id,
            'type' => $this->call->type,
            'caller' => [
                'id' => $this->caller->id,
                'name' => $this->caller->name,
                'avatar' => $this->caller->avatar ?? 'https://placehold.co/100x100',
            ],
        ];
    }
}
