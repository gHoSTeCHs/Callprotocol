<?php

namespace App\Http\Controllers;

use App\Models\User;
use Faker\Factory as Faker;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class ContactController extends Controller
{
    public function index(): Response
    {
        $faker = Faker::create();

        $userContacts = User::query()
            ->where('id', '!=', Auth::user()->id)
            ->get()->map(function ($user) use ($faker) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'avatar' => $user->avatar ?? $faker->imageUrl(100, 100, 'people'),
                    'status' => $faker->randomElement(['online', 'offline', 'busy', 'away']),
                    'lastSeen' => $faker->dateTimeThisMonth()->format('Y-m-d H:i:s'),
                    'favorite' => $faker->boolean(20),
                    'email' => $user->email,
                    'phone' => $faker->phoneNumber(),
                    'department' => $faker->randomElement(['Sales', 'Marketing', 'IT', 'HR', 'Finance']),
                    'location' => $faker->city(),
                ];
            });
        return Inertia::render('contact/contacts', [
            'userContacts' => $userContacts
        ]);
    }
}
