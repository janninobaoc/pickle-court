<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Court;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class BookingReschedulingConcurrencyTest extends TestCase
{
    public function test_only_one_booking_can_be_rescheduled_into_a_shared_slot(): void
    {
        $this->assertSafeTestDatabase();

        $userIds = [];
        $bookingIds = [];
        $courtId = null;
        $syncDirectory = null;
        $children = [];

        try {
            $this->assertSame(0, DB::transactionLevel(), 'Fixtures must be created outside a parent transaction.');

            $users = [];
            foreach ([0, 1] as $index) {
                $user = User::factory()->create();
                $users[$index] = $user;
                $userIds[$index] = (int) $user->id;
            }
            $this->assertNotSame($userIds[0], $userIds[1]);

            $bookingDate = Carbon::now(config('app.timezone'))->addDays(14)->toDateString();
            $weekday = Carbon::createFromFormat('!Y-m-d', $bookingDate, config('app.timezone'))->format('l');
            $court = Court::factory()->create([
                'status' => 'available',
                'hourly_rate' => 300.00,
                'opening_time' => '08:00:00',
                'closing_time' => '22:00:00',
                'operating_days' => [$weekday],
            ]);
            $courtId = (int) $court->id;

            $originals = [
                ['start_time' => '09:00:00', 'end_time' => '10:00:00', 'status' => 'pending'],
                ['start_time' => '12:00:00', 'end_time' => '13:00:00', 'status' => 'confirmed'],
            ];
            foreach ($users as $index => $user) {
                $booking = Booking::factory()->create([
                    'user_id' => $user->id,
                    'court_id' => $courtId,
                    'booking_date' => $bookingDate,
                    'start_time' => $originals[$index]['start_time'],
                    'end_time' => $originals[$index]['end_time'],
                    'status' => $originals[$index]['status'],
                    'total_amount' => 300.00,
                ]);
                $bookingIds[$index] = (int) $booking->id;
                $originals[$index]['user_id'] = (int) $user->id;
                $originals[$index]['court_id'] = $courtId;
                $originals[$index]['booking_date'] = $bookingDate;
                $originals[$index]['total_amount'] = '300.00';
            }

            // No outer transaction is active, so these fixture inserts are committed and visible to workers.
            $this->assertSame(2, User::whereKey($userIds)->count());
            $this->assertSame(2, Booking::whereKey($bookingIds)->count());
            $this->assertTrue(Court::whereKey($courtId)->exists());
            $this->assertSame(0, DB::table('bookings')
                ->where('court_id', $courtId)
                ->where('booking_date', $bookingDate)
                ->where('start_time', '<', '17:00:00')
                ->where('end_time', '>', '15:00:00')
                ->whereIn('status', ['pending', 'confirmed'])
                ->count());

            $target = [
                'booking_date' => $bookingDate,
                'start_time' => '15:00:00',
                'end_time' => '17:00:00',
            ];
            $syncDirectory = sys_get_temp_dir()
                . DIRECTORY_SEPARATOR
                . 'picklecourt-reschedule-concurrency-'
                . bin2hex(random_bytes(10));
            if (!mkdir($syncDirectory, 0700) && !is_dir($syncDirectory)) {
                $this->fail('Could not create the temporary worker synchronization directory.');
            }

            $workerPath = base_path('tests/Support/BookingConcurrencyWorker.php');
            $gatePath = $syncDirectory . DIRECTORY_SEPARATOR . 'start.gate';
            foreach ([0, 1] as $index) {
                $readyPath = $syncDirectory . DIRECTORY_SEPARATOR . 'ready-' . $index;
                $resultPath = $syncDirectory . DIRECTORY_SEPARATOR . 'result-' . $index . '.json';
                $command = [
                    PHP_BINARY,
                    $workerPath,
                    (string) $userIds[$index],
                    (string) $courtId,
                    $target['booking_date'],
                    $target['start_time'],
                    $target['end_time'],
                    $gatePath,
                    $readyPath,
                    $resultPath,
                    'reschedule',
                    (string) $bookingIds[$index],
                ];
                $process = new Process($command, base_path());
                $process->setTimeout(null);
                $process->start();
                $children[$index] = ['process' => $process, 'exit_code' => null];
            }

            $this->waitForWorkersToBeReady($children, $syncDirectory);
            if (file_put_contents($gatePath, 'start', LOCK_EX) === false) {
                $this->fail('Could not release the rescheduling worker start gate.');
            }
            $this->waitForWorkersToFinish($children, $syncDirectory);

            $results = [];
            foreach ([0, 1] as $index) {
                $resultPath = $syncDirectory . DIRECTORY_SEPARATOR . 'result-' . $index . '.json';
                $contents = is_file($resultPath) ? file_get_contents($resultPath) : false;
                $result = is_string($contents) ? json_decode($contents, true) : null;

                $this->assertIsArray($result, 'A worker did not return a valid result.');
                $this->assertSame(0, $children[$index]['exit_code'], 'A rescheduling worker exited unsuccessfully.');
                $this->assertArrayNotHasKey('worker_error_class', $result, 'A worker failed before completing its request.');
                $this->assertSame($userIds[$index], (int) ($result['worker_user_id'] ?? 0));
                $results[] = $result;
            }

            $statuses = array_column($results, 'http_status');
            sort($statuses);
            $this->assertSame([200, 409], $statuses);

            $successes = array_values(array_filter(
                $results,
                static fn (array $result): bool => ($result['http_status'] ?? null) === 200
            ));
            $this->assertCount(1, $successes);
            $successfulResult = $successes[0];
            $this->assertSame(
                (int) $successfulResult['worker_user_id'],
                (int) $successfulResult['booking_user_id']
            );

            $winnerIndex = array_search((int) $successfulResult['worker_user_id'], $userIds, true);
            $this->assertNotFalse($winnerIndex);
            $loserIndex = $winnerIndex === 0 ? 1 : 0;

            $finalBookings = DB::table('bookings')->whereIn('id', $bookingIds)->get()->keyBy('id');
            $this->assertCount(2, $finalBookings, 'Both original booking records must remain.');
            $this->assertSame(2, DB::table('bookings')->where('court_id', $courtId)->count(), 'No booking may be created or deleted.');

            $targetBookings = DB::table('bookings')
                ->whereIn('id', $bookingIds)
                ->where('court_id', $courtId)
                ->where('booking_date', $target['booking_date'])
                ->where('start_time', '<', $target['end_time'])
                ->where('end_time', '>', $target['start_time'])
                ->whereIn('status', ['pending', 'confirmed'])
                ->get();
            $this->assertCount(1, $targetBookings, 'Exactly one blocking fixture booking may occupy the target slot.');

            foreach ([0, 1] as $index) {
                $final = $finalBookings->get($bookingIds[$index]);
                $this->assertNotNull($final);
                $this->assertSame($originals[$index]['user_id'], (int) $final->user_id);
                $this->assertSame($originals[$index]['court_id'], (int) $final->court_id);
                $this->assertSame($originals[$index]['status'], $final->status);
            }

            $winner = $finalBookings->get($bookingIds[$winnerIndex]);
            $loser = $finalBookings->get($bookingIds[$loserIndex]);
            $this->assertSame($target['booking_date'], $winner->booking_date);
            $this->assertSame($target['start_time'], $winner->start_time);
            $this->assertSame($target['end_time'], $winner->end_time);
            $this->assertEquals('600.00', (string) $winner->total_amount);

            $this->assertSame($originals[$loserIndex]['booking_date'], $loser->booking_date);
            $this->assertSame($originals[$loserIndex]['start_time'], $loser->start_time);
            $this->assertSame($originals[$loserIndex]['end_time'], $loser->end_time);
            $this->assertEquals($originals[$loserIndex]['total_amount'], (string) $loser->total_amount);

            foreach ([0, 1] as $index) {
                $booking = $finalBookings->get($bookingIds[$index]);
                $isWinner = $index === $winnerIndex;
                $this->assertTrue(
                    $isWinner
                        ? $booking->booking_date === $target['booking_date']
                            && $booking->start_time === $target['start_time']
                            && $booking->end_time === $target['end_time']
                        : $booking->booking_date === $originals[$index]['booking_date']
                            && $booking->start_time === $originals[$index]['start_time']
                            && $booking->end_time === $originals[$index]['end_time'],
                    'A booking has a partial or inconsistent schedule update.'
                );
            }
        } finally {
            $this->terminateWorkers($children);

            try {
                if ($courtId !== null || $bookingIds !== [] || $userIds !== []) {
                    // Fail closed: do not delete fixtures if the live connection no longer passes safety checks.
                    $this->assertSafeTestDatabase();

                    if ($bookingIds !== []) {
                        DB::table('bookings')->whereIn('id', $bookingIds)->delete();
                    }
                    if ($courtId !== null) {
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
                    $this->fail('A rescheduling worker exited before both workers were ready.');
                }
            }
            usleep(20000);
        }
        $this->fail('Timed out waiting for both rescheduling workers to become ready.');
    }

    private function waitForWorkersToFinish(array &$children, string $syncDirectory): void
    {
        $deadline = microtime(true) + 45;
        while (microtime(true) < $deadline) {
            $this->collectWorkerOutputAndExitCodes($children);
            foreach ($children as $index => $child) {
                if ($child['exit_code'] !== null && $child['exit_code'] !== 0) {
                    $resultPath = $syncDirectory . DIRECTORY_SEPARATOR . 'result-' . $index . '.json';
                    $contents = is_file($resultPath) ? @file_get_contents($resultPath) : false;
                    $result = is_string($contents) ? json_decode($contents, true) : null;
                    $diagnostic = 'diagnostic data unavailable';

                    if (is_array($result)) {
                        $class = $result['worker_error_class'] ?? null;
                        $code = $result['worker_error_code'] ?? null;
                        $file = $result['worker_error_file'] ?? null;
                        $line = $result['worker_error_line'] ?? null;
                        $parts = [];
                        if (is_string($class) && preg_match('/^[A-Za-z_][A-Za-z0-9_\\]*$/', $class) === 1
                            && (is_int($code) || (is_string($code) && is_numeric($code)))) {
                            $parts[] = 'exception class ' . $class . ', code ' . (int) $code;
                        }
                        if (is_string($file) && preg_match('~^[A-Za-z0-9_./-]+$~', $file) === 1
                            && !str_contains($file, '..')
                            && (is_int($line) || (is_string($line) && ctype_digit($line)))) {
                            $parts[] = 'file ' . $file . ', line ' . (int) $line;
                        }
                        if ($parts !== []) {
                            $diagnostic = implode('; ', $parts);
                        }
                    }

                    $workerName = $index === 0 ? 'A' : 'B';
                    $this->fail('Rescheduling worker ' . $workerName . ' failed with exit code '
                        . $child['exit_code'] . '; ' . $diagnostic . '.');
                }
            }

            if ($children[0]['exit_code'] !== null && $children[1]['exit_code'] !== null) {
                return;
            }
            usleep(20000);
        }
        $this->fail('Timed out waiting for rescheduling workers to finish.');
    }

    private function collectWorkerOutputAndExitCodes(array &$children): void
    {
        foreach ($children as &$child) {
            if ($child['exit_code'] === null && !$child['process']->isRunning()) {
                $child['exit_code'] = $child['process']->getExitCode();
                $child['stdout'] = $child['process']->getOutput();
                $child['stderr'] = $child['process']->getErrorOutput();
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

        foreach ([
            'start.gate',
            'ready-0',
            'ready-1',
            'result-0.json',
            'result-1.json',
        ] as $name) {
            $path = $syncDirectory . DIRECTORY_SEPARATOR . $name;
            if (is_file($path)) {
                unlink($path);
            }
        }
        rmdir($syncDirectory);
    }
}
