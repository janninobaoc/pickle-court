<?php

namespace Tests\Feature;

use App\Models\Court;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class BookingConcurrencyTest extends TestCase
{
    /**
     * This intentionally does not use RefreshDatabase: worker processes need to
     * see committed fixtures through their independent database connections.
     */
    public function test_only_one_simultaneous_request_can_book_a_court_slot(): void
    {
        $this->assertSafeTestDatabase();

        $userIds = [];
        $courtId = null;
        $syncDirectory = null;
        $children = [];

        try {
            $this->assertSame(0, DB::transactionLevel(), 'Fixtures must be created outside a parent transaction.');

            $users = [User::factory()->create(), User::factory()->create()];
            $userIds = array_map(static fn (User $user): int => (int) $user->id, $users);
            $this->assertNotSame($userIds[0], $userIds[1]);

            $bookingDate = Carbon::now()->addDays(14)->toDateString();
            $weekday = Carbon::createFromFormat('!Y-m-d', $bookingDate)->format('l');

            $court = Court::factory()->create([
                'status' => 'available',
                'hourly_rate' => 300.00,
                'opening_time' => '08:00:00',
                'closing_time' => '22:00:00',
                'operating_days' => [$weekday],
            ]);
            $courtId = (int) $court->id;

            // Factory/model inserts autocommit because this test has no outer transaction.
            $this->assertSame(2, User::whereKey($userIds)->count());
            $this->assertTrue(Court::whereKey($courtId)->exists());

            $syncDirectory = sys_get_temp_dir()
                . DIRECTORY_SEPARATOR
                . 'picklecourt-booking-concurrency-'
                . bin2hex(random_bytes(10));

            if (!mkdir($syncDirectory, 0700) && !is_dir($syncDirectory)) {
                $this->fail('Could not create the temporary worker synchronization directory.');
            }

            $workerPath = base_path('tests/Support/BookingConcurrencyWorker.php');
            $gatePath = $syncDirectory . DIRECTORY_SEPARATOR . 'start.gate';

            foreach ($userIds as $index => $userId) {
                $readyPath = $syncDirectory . DIRECTORY_SEPARATOR . 'ready-' . $index;
                $resultPath = $syncDirectory . DIRECTORY_SEPARATOR . 'result-' . $index . '.json';
                $command = [
                    PHP_BINARY,
                    $workerPath,
                    (string) $userId,
                    (string) $courtId,
                    $bookingDate,
                    '09:00:00',
                    '10:00:00',
                    $gatePath,
                    $readyPath,
                    $resultPath,
                ];
                $process = new Process($command, base_path());
                $process->setTimeout(null);
                $process->start();
                $children[$index] = [
                    'process' => $process,
                    'exit_code' => null,
                ];
            }

            $this->waitForWorkersToBeReady($children, $syncDirectory);
            if (file_put_contents($gatePath, 'start', LOCK_EX) === false) {
                $this->fail('Could not release the booking worker start gate.');
            }

            $this->waitForWorkersToFinish($children, $syncDirectory);

            $results = [];
            foreach ([0, 1] as $index) {
                $resultPath = $syncDirectory . DIRECTORY_SEPARATOR . 'result-' . $index . '.json';
                $contents = is_file($resultPath) ? file_get_contents($resultPath) : false;
                $result = is_string($contents) ? json_decode($contents, true) : null;

                $this->assertIsArray($result, 'A worker did not return a valid result.');
                $this->assertSame(0, $children[$index]['exit_code'], 'A booking worker exited unsuccessfully.');
                $this->assertArrayNotHasKey('worker_error_class', $result, 'A worker failed before completing its request.');
                $this->assertSame($userIds[$index], (int) ($result['worker_user_id'] ?? 0));
                $results[] = $result;
            }

            $statuses = array_column($results, 'http_status');
            sort($statuses);
            $this->assertSame([201, 409], $statuses);

            $successfulResults = array_values(array_filter(
                $results,
                static fn (array $result): bool => ($result['http_status'] ?? null) === 201
            ));
            $this->assertCount(1, $successfulResults);
            $successfulResult = $successfulResults[0] ?? null;
            $this->assertIsArray($successfulResult);
            $this->assertSame(
                (int) $successfulResult['worker_user_id'],
                (int) $successfulResult['booking_user_id']
            );

            $blockingBookings = DB::table('bookings')
                ->where('court_id', $courtId)
                ->where('booking_date', $bookingDate)
                ->where('start_time', '<', '10:00:00')
                ->where('end_time', '>', '09:00:00')
                ->whereIn('status', ['pending', 'confirmed'])
                ->get(['user_id', 'start_time', 'end_time']);

            $this->assertCount(1, $blockingBookings);
            $this->assertSame(
                (int) $successfulResult['booking_user_id'],
                (int) $blockingBookings->first()->user_id
            );
        } finally {
            $this->terminateWorkers($children);

            try {
                if ($courtId !== null || $userIds !== []) {
                    // Never clean up unless the live connection still passes the safety gate.
                    $this->assertSafeTestDatabase();

                    if ($courtId !== null) {
                        DB::table('bookings')->where('court_id', $courtId)->delete();
                        Court::whereKey($courtId)->delete();
                    }

                    if ($userIds !== []) {
                        User::whereKey($userIds)->delete();
                    }
                }
            } finally {
                $this->removeSynchronizationFiles($syncDirectory);
            }
        }
    }

    private function assertSafeTestDatabase(): void
    {
        $this->assertSame('testing', app()->environment(), 'APP_ENV must be testing.');
        $this->assertSame('mysql', config('database.default'), 'The test connection must be mysql.');
        $this->assertSame(
            'system_backend_test',
            config('database.connections.mysql.database'),
            'The test connection must use system_backend_test.'
        );
        $this->assertSame(
            'picklecourt_test',
            config('database.connections.mysql.username'),
            'The test connection must use the restricted test account.'
        );

        $identity = DB::selectOne(
            'SELECT DATABASE() AS database_name, CURRENT_USER() AS account_name'
        );
        $this->assertSame('system_backend_test', $identity->database_name);
        $this->assertSame('picklecourt_test@localhost', $identity->account_name);

        $testDatabaseGrantFound = false;
        foreach (DB::select('SHOW GRANTS FOR CURRENT_USER()') as $grantRow) {
            $grantValues = array_values((array) $grantRow);
            $grant = strtoupper(str_replace(['`', "'"], '', (string) ($grantValues[0] ?? '')));

            if (!preg_match('/^GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO\s+/', $grant, $matches)) {
                $this->fail('The test account has an unrecognized grant; refusing database use.');
            }

            $privileges = trim($matches[1]);
            $scope = trim($matches[2]);

            if ($scope === '*.*') {
                $this->assertSame('USAGE', $privileges, 'Global database privileges are forbidden.');
            } elseif ($scope === 'SYSTEM_BACKEND_TEST.*') {
                $testDatabaseGrantFound = true;
                $this->assertStringNotContainsString('WITH GRANT OPTION', $grant);
            } else {
                $this->fail('The test account has a grant outside system_backend_test.');
            }

            $this->assertStringNotContainsString('SYSTEM_BACKEND.*', $grant);
        }

        $this->assertTrue($testDatabaseGrantFound, 'The test account lacks an explicit test database grant.');
    }

    private function waitForWorkersToBeReady(array &$children, string $syncDirectory): void
    {
        $deadline = microtime(true) + 30;
        while (microtime(true) < $deadline) {
            $ready = is_file($syncDirectory . DIRECTORY_SEPARATOR . 'ready-0')
                && is_file($syncDirectory . DIRECTORY_SEPARATOR . 'ready-1');

            $this->collectWorkerOutputAndExitCodes($children);
            if ($ready) {
                return;
            }

            foreach ($children as $child) {
                if ($child['exit_code'] !== null) {
                    $this->fail('A worker exited before both workers reached the start gate.');
                }
            }

            usleep(20000);
        }

        $this->fail('Timed out waiting for both booking workers to become ready.');
    }

    private function waitForWorkersToFinish(array &$children, string $syncDirectory): void
    {
        $deadline = microtime(true) + 45;
        while (microtime(true) < $deadline) {
            $this->collectWorkerOutputAndExitCodes($children);
            foreach ($children as $index => $child) {
                if ($child['exit_code'] !== null && $child['exit_code'] !== 0) {
                    $resultPath = $syncDirectory
                        . DIRECTORY_SEPARATOR
                        . 'result-'
                        . $index
                        . '.json';
                    $resultContents = is_file($resultPath) ? @file_get_contents($resultPath) : false;
                    $result = is_string($resultContents)
                        ? json_decode($resultContents, true)
                        : null;
                    $diagnosticParts = [];

                    if (is_array($result)) {
                        $exceptionClass = $result['worker_error_class'] ?? null;
                        $exceptionCode = $result['worker_error_code'] ?? null;
                        $exceptionFile = $result['worker_error_file'] ?? null;
                        $exceptionLine = $result['worker_error_line'] ?? null;

                        if (
                            is_string($exceptionClass)
                            && preg_match('/^[A-Za-z_][A-Za-z0-9_\\\\]*$/', $exceptionClass) === 1
                            && (is_int($exceptionCode) || (is_string($exceptionCode) && is_numeric($exceptionCode)))
                        ) {
                            $diagnosticParts[] = 'exception class ' . $exceptionClass
                                . ', exception code ' . (int) $exceptionCode;
                        }

                        if (
                            is_string($exceptionFile)
                            && preg_match('~^[A-Za-z0-9_./-]+$~', $exceptionFile) === 1
                            && !str_contains($exceptionFile, '..')
                            && (is_int($exceptionLine)
                                || (is_string($exceptionLine) && ctype_digit($exceptionLine)))
                        ) {
                            $diagnosticParts[] = 'exception file ' . $exceptionFile
                                . ', line ' . (int) $exceptionLine;
                        }
                    }

                    $diagnostic = $diagnosticParts === []
                        ? 'diagnostic data unavailable'
                        : implode('; ', $diagnosticParts);

                    $workerName = $index === 0 ? 'A' : 'B';
                    $this->fail(
                        'Booking worker ' . $workerName
                        . ' failed with exit code ' . $child['exit_code']
                        . '; ' . $diagnostic . '.'
                    );
                }
            }

            if ($children[0]['exit_code'] !== null && $children[1]['exit_code'] !== null) {
                return;
            }

            usleep(20000);
        }

        $this->fail('Timed out waiting for booking worker processes to finish.');
    }

    private function collectWorkerOutputAndExitCodes(array &$children): void
    {
        foreach ($children as &$child) {
            if ($child['exit_code'] === null) {
                $process = $child['process'];
                if (!$process->isRunning()) {
                    $child['exit_code'] = $process->getExitCode();
                    $child['stdout'] = $process->getOutput();
                    $child['stderr'] = $process->getErrorOutput();
                }
            }
        }
        unset($child);
    }

    private function terminateWorkers(array &$children): void
    {
        foreach ($children as &$child) {
            if (isset($child['process']) && $child['process']->isRunning()) {
                $child['process']->stop(0.5);
            }
        }
        unset($child);

        foreach ($children as &$child) {
            if (isset($child['process'])) {
                $child['stdout'] = $child['process']->getOutput();
                $child['stderr'] = $child['process']->getErrorOutput();
                if ($child['exit_code'] === null) {
                    $child['exit_code'] = $child['process']->getExitCode();
                }
            }
        }
        unset($child);
    }

    private function removeSynchronizationFiles(?string $syncDirectory): void
    {
        if ($syncDirectory === null || !is_dir($syncDirectory)) {
            return;
        }

        $paths = [
            $syncDirectory . DIRECTORY_SEPARATOR . 'start.gate',
            $syncDirectory . DIRECTORY_SEPARATOR . 'ready-0',
            $syncDirectory . DIRECTORY_SEPARATOR . 'ready-1',
            $syncDirectory . DIRECTORY_SEPARATOR . 'result-0.json',
            $syncDirectory . DIRECTORY_SEPARATOR . 'result-1.json',
        ];

        foreach ($paths as $path) {
            if (is_file($path)) {
                unlink($path);
            }
        }

        rmdir($syncDirectory);
    }
}
