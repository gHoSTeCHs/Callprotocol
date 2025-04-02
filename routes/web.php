<?php

use App\Events\TestBroadcast;
use App\Http\Controllers\CallController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\SignalingController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    // Contacts
    Route::get('contacts', [ContactController::class, 'index'])->name('contacts.index');
    Route::post('/calls', [CallController::class, 'initiateCall']);
    Route::patch('/calls/{call}', [CallController::class, 'updateCallStatus']);
    Route::post('/signaling', [SignalingController::class, 'sendSignal']);

    Route::post('/broadcasting/auth', function () {
        return Auth::user();
    });
});

Route::post('/test-broadcast/{user_id}', function(Request $request, $userId) {
    Log::info('Testing broadcast to user', [
        'user_id' => $userId,
        'data' => $request->all()
    ]);

    broadcast(new TestBroadcast($userId, 'Test message'))->toOthers();

    return response()->json(['status' => 'broadcasted']);
});


Broadcast::routes(['middleware' => ['auth:sanctum']]);
Broadcast::routes(['middleware' => ['auth', 'verified']]);

require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';
