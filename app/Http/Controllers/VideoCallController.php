<?php

namespace App\Http\Controllers;

use App\Events\RequestVideoCall;
use App\Events\RequestVideoCallStatus;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VideoCallController extends Controller
{
    /**
     * Send a video call request to a user
     *
     * @param Request $request
     * @param int $userId ID of the user to call
     * @return JsonResponse
     */
    public function request(Request $request, $userId): JsonResponse
    {
        $request->validate([
            'peerId' => 'required|string',
        ]);

        $toUser = User::query()->findOrFail($userId);
        $fromUser = auth()->user();


        broadcast(new RequestVideoCall($toUser, [
            'fromUser' => $fromUser,
            'peerId' => $request->peerId
        ]))->toOthers();

        return response()->json(['status' => 'success']);

    }

    /**
     * Update the status of a video call request
     *
     * @param Request $request
     * @param int $userId ID of the user who initiated the call
     * @return JsonResponse
     */
    public function requestStatus(Request $request, int $userId): JsonResponse
    {
        $request->validate([
            'peerId' => 'required|string',
            'status' => 'required|string|in:accept,reject',
        ]);

        $toUser = User::query()->findOrFail($userId);

        broadcast(new RequestVideoCallStatus($toUser, [
            'peerId' => $request->peerId,
            'status' => $request->status
        ]))->toOthers();

        return response()->json(['status' => 'success']);
    }
}
