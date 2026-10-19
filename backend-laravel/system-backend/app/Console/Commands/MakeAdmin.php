<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use App\Models\User;

#[Signature('user:make-admin {email}')]
#[Description('Promote an existing user to administrator')]
class MakeAdmin extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        // 1. Get the email argument
        $email = $this->argument('email');

        // 2. Find the user
        $user = User::where('email', $email)->first();

        // 3. Check whether the user exists
        if (!$user) {
            $this->error('User not found.');

            return self::FAILURE;
        }

        // 4. Check whether the user is already an admin
        if ($user->role === 'admin') {
            $this->info('This user is already an administrator.');

            return self::SUCCESS;
        }

        if ($user->role !== 'customer') {
            $this->error('Only customer accounts can be promoted.');

            return self::FAILURE;
        }

        // 5. Promote the user
        $user->role = 'admin';

        if (!$user->save()) {
            $this->error('Failed to promote user.');

            return self::FAILURE;
        }

        $this->info('User successfully promoted to administrator.');

        return self::SUCCESS;
    }
}
