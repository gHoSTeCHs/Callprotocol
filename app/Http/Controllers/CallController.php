<?php

namespace App\Http\Controllers;

use App\Events\CallStatusChanged;
use App\Events\IncomingCall;
use App\Models\Call;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CallController extends Controller
{

    public function initiateCall(Request $request): JsonResponse
    {
        $request->validate([
            'receiver_id' => 'required|exists:users,id',
            'type' => 'required|in:audio,video',
        ]);

        $caller = Auth::user();
        $receiver = User::query()->find($request->receiver_id);

        // Create a new call record
        $call = Call::query()->create([
            'caller_id' => $caller->id,
            'receiver_id' => $receiver->id,
            'type' => $request->type,
            'status' => 'ringing',
        ]);

        // Broadcast event to the receiver
        broadcast(new IncomingCall($call, $caller, $receiver))->toOthers();

        return response()->json([
            'call_id' => $call->id,
            'status' => 'ringing'
        ]);
    }

    public function updateCallStatus(Request $request, Call $call): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:accepted,rejected,ended',
        ]);

        $call->status = $request->status;

        if ($request->status === 'accepted') {
            $call->started_at = now();
        }

        if ($request->status === 'ended' || $request->status === 'rejected') {
            $call->ended_at = now();
        }

        $call->save();

        // Broadcast the updated status
        broadcast(new CallStatusChanged($call))->toOthers();

        return response()->json(['status' => $call->status]);
    }
}
