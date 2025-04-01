<?php

namespace App\Models;

use Database\Factories\CallFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Call extends Model
{
    /** @use HasFactory<CallFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = ['caller_id', 'receiver_id', 'type', 'status'];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'ended_at' => 'datetime',
    ];

    /**
     * Get the user who initiated the call.
     */
    public function caller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'caller_id');
    }

    /**
     * Get the user who received the call.
     */
    public function callee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'callee_id');
    }
}

