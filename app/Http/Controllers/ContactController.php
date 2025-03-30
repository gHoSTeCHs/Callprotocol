<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class ContactController extends Controller
{
    public function index(): Response
    {
        $contacts = User::query()->where('id', '!=', Auth::user()->id)->get();
        return Inertia::render('contact/index', [
            'contacts' => $contacts
        ]);
    }
}
