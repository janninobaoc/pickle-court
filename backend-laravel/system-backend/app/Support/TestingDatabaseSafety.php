<?php

namespace App\Support;

use Illuminate\Contracts\Foundation\Application;
use Illuminate\Database\QueryException;
use RuntimeException;
use Throwable;

final class TestingDatabaseSafety
{
    private const CONNECTION = 'mysql';
    private const HOST = '127.0.0.1';
    private const PORT = 3306;
    private const DATABASE = 'system_backend_test';
    private const USERNAME = 'picklecourt_test';
    private const ACCOUNT = 'picklecourt_test@localhost';

    /**
     * Fail closed unless Laravel's actual testing connection is the isolated
     * MariaDB test database and the test account cannot read the development DB.
     */
    public static function assertSafe(Application $app): void
    {
        if ($app->environment() !== 'testing') {
            throw new RuntimeException('Database safety check requires APP_ENV=testing.');
        }

        $config = $app['config'];
        $default = $config->get('database.default');
        $connections = $config->get('database.connections', []);

        if ($default !== self::CONNECTION || ! is_array($connections)) {
            throw new RuntimeException('Testing database connection is not the approved MySQL connection.');
        }

        $mysql = $connections[self::CONNECTION] ?? null;

        if (! is_array($mysql)
            || ($mysql['driver'] ?? null) !== 'mysql'
            || ! empty($mysql['url'])
            || ($mysql['host'] ?? null) !== self::HOST
            || (int) ($mysql['port'] ?? 0) !== self::PORT
            || ($mysql['database'] ?? null) !== self::DATABASE
            || ($mysql['username'] ?? null) !== self::USERNAME) {
            throw new RuntimeException('Testing database configuration does not match the approved isolated connection.');
        }

        foreach ($connections as $name => $connection) {
            if (! is_array($connection)) {
                throw new RuntimeException('An unexpected database connection is configured for testing.');
            }

            if (! empty($connection['url']) || ($connection['database'] ?? null) === 'system_backend') {
                throw new RuntimeException('An unexpected database URL or development database is configured for testing.');
            }
        }

        try {
            $connection = $app->make('db')->connection(self::CONNECTION);
            $identity = $connection->selectOne(
                'SELECT DATABASE() AS database_name, @@port AS port, CURRENT_USER() AS authenticated_account'
            );
        } catch (Throwable) {
            throw new RuntimeException('Could not verify the live testing database connection.');
        }

        if (($identity->database_name ?? null) !== self::DATABASE
            || (int) ($identity->port ?? 0) !== self::PORT
            || ($identity->authenticated_account ?? null) !== self::ACCOUNT) {
            throw new RuntimeException('Live testing database identity does not match the approved isolated connection.');
        }

        self::assertGrantsAreScopedToTestDatabase($connection);

        try {
            $connection->select('SELECT 1 FROM system_backend.users LIMIT 0');
        } catch (QueryException $exception) {
            $nativeCode = (int) ($exception->errorInfo[1] ?? 0);

            if (in_array($nativeCode, [1044, 1142], true)) {
                return;
            }

            throw new RuntimeException('Could not verify that the testing account is denied access to the development database.');
        }

        throw new RuntimeException('The testing account can access the development database.');
    }

    private static function assertGrantsAreScopedToTestDatabase($connection): void
    {
        try {
            $grants = $connection->select('SHOW GRANTS');
        } catch (Throwable) {
            throw new RuntimeException('Could not verify the testing account privileges.');
        }

        if ($grants === []) {
            throw new RuntimeException('The testing account has no verifiable database grants.');
        }

        foreach ($grants as $grantRow) {
            $statement = strtoupper(implode(' ', array_map('strval', array_values((array) $grantRow))));
            $statement = str_replace(['`', "'"], '', $statement);
            $statement = preg_replace('/\s+/', ' ', trim($statement));

            if (str_starts_with($statement, 'GRANT USAGE ON *.* ')) {
                continue;
            }

            if (preg_match('/\bON SYSTEM_BACKEND_TEST\.(\*|[A-Z0-9_]+)/', $statement) === 1) {
                continue;
            }

            throw new RuntimeException('The testing account has a grant outside the isolated test database.');
        }
    }

    public static function isDatabaseMutationCommand(?string $command): bool
    {
        return $command === 'migrate'
            || ($command !== null && str_starts_with($command, 'migrate:'))
            || in_array($command, ['db:seed', 'db:wipe', 'schema:dump'], true);
    }
}
