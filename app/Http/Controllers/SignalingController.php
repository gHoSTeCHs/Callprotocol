<?php

namespace App\Http\Controllers;

use App\Events\WebRTCSignal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class SignalingController extends Controller
{
    public function sendSignal(Request $request): JsonResponse
    {
        $request->validate([
            'receiver_id' => 'required|exists:users,id',
            'call_id' => 'required|exists:calls,id',
            'signal' => 'required',
        ]);

        Log::info('WebRTC Signaling:', [
            'receiver_id' => $request->receiver_id,
            'call_id' => $request->call_id,
            'signal_type' => $request->signal['type'] ?? 'unknown',
        ]);

        broadcast(new WebRTCSignal(
            $request->call_id,
            $request->receiver_id,
            Auth::id(),
            $request->signal
        ))->toOthers();

        return response()->json(['success' => true]);
    }
}
