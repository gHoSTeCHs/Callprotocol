<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TestBroadcast implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $userId;
    public string $message;

    /**
     * Create a new event instance.
     *
     * @param int $userId
     * @param string $message
     * @return void
     */
    public function __construct(int $userId, string $message)
    {
        $this->userId = $userId;
        $this->message = $message;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return Channel
     */
    public function broadcastOn(): Channel|PrivateChannel
    {
        return new PrivateChannel('user.' . $this->userId);
    }

    /**
     * The data to broadcast.
     *
     * @return array
     */
    public function broadcastWith(): array
    {
        return [
            'message' => $this->message,
            'timestamp' => now()->toIso8601String(),
            'test' => true
        ];
    }
}
