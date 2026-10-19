<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use App\Support\TestingDatabaseSafety;
use Illuminate\Console\Application as ConsoleApplication;
use Symfony\Component\Console\ConsoleEvents;
use Symfony\Component\Console\Event\ConsoleCommandEvent;
use Symfony\Component\EventDispatcher\EventDispatcher;

class AppServiceProvider extends ServiceProvider
{
    private static bool $testingDatabaseGuardRegistered = false;

    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::define('manage-courts', function (User $user): bool {
            return $user->role === 'admin';
        });

        Gate::define('access-admin-api', function (User $user): bool {
            return $user->role === 'admin';
        });

        if ($this->app->environment('testing') && !self::$testingDatabaseGuardRegistered) {
            self::$testingDatabaseGuardRegistered = true;

            ConsoleApplication::starting(function (ConsoleApplication $artisan): void {
                $dispatcher = new EventDispatcher();

                $dispatcher->addListener(ConsoleEvents::COMMAND, function (ConsoleCommandEvent $event): void {
                    $command = $event->getCommand()?->getName();

                    if (!TestingDatabaseSafety::isDatabaseMutationCommand($command)) {
                        return;
                    }

                    try {
                        $connectionOverride = $event->getInput()->getOption('database');
                    } catch (\InvalidArgumentException) {
                        $connectionOverride = null;
                    }

                    if ($connectionOverride !== null && $connectionOverride !== '' && $connectionOverride !== 'mysql') {
                        throw new \RuntimeException('Database mutation command selected an unexpected connection.');
                    }

                    TestingDatabaseSafety::assertSafe(app());
                });

                $artisan->setDispatcher($dispatcher);
            });
        }
    }
}
