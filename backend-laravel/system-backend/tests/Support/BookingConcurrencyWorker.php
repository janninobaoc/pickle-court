<?php

use App\Models\Court;
use App\Models\Booking;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel as ConsoleKernel;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

ini_set('display_errors', '0');

[$script, $userId, $courtId, $bookingDate, $startTime, $endTime, $gatePath, $readyPath, $resultPath] = $argv;
$operation = $argv[9] ?? 'create';
$bookingId = isset($argv[10]) ? (int) $argv[10] : null;
$basePath = dirname(__DIR__, 2);

putenv('APP_ENV=testing');
$_ENV['APP_ENV'] = 'testing';
$_SERVER['APP_ENV'] = 'testing';

require $basePath . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';

$result = [
    'worker_user_id' => (int) $userId,
    'http_status' => null,
    'booking_user_id' => null,
    'response_message' => null,
];

try {
    if (!in_array($operation, ['create', 'reschedule'], true)) {
        throw new RuntimeException('Worker operation is unsupported.');
    }
    if ($operation === 'reschedule' && ($bookingId === null || $bookingId < 1)) {
        throw new RuntimeException('Worker booking reference is invalid.');
    }

    $app = require $basePath . DIRECTORY_SEPARATOR . 'bootstrap' . DIRECTORY_SEPARATOR . 'app.php';
    $consoleKernel = $app->make(ConsoleKernel::class);
    $consoleKernel->bootstrap();
    $httpKernel = $app->make(HttpKernel::class);

    if (app()->environment() !== 'testing'
        || config('database.default') !== 'mysql'
        || config('database.connections.mysql.database') !== 'system_backend_test'
        || config('database.connections.mysql.username') !== 'picklecourt_test') {
        throw new RuntimeException('Worker database configuration failed safety checks.');
    }

    $identity = DB::selectOne(
        'SELECT DATABASE() AS database_name, CURRENT_USER() AS account_name'
    );
    if ($identity->database_name !== 'system_backend_test'
        || $identity->account_name !== 'picklecourt_test@localhost') {
        throw new RuntimeException('Worker database identity failed safety checks.');
    }

    $testDatabaseGrantFound = false;
    foreach (DB::select('SHOW GRANTS FOR CURRENT_USER()') as $grantRow) {
        $grantValues = array_values((array) $grantRow);
        $grant = strtoupper(str_replace(['`', "'"], '', (string) ($grantValues[0] ?? '')));
        if (!preg_match('/^GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO\s+/', $grant, $matches)) {
            throw new RuntimeException('Worker grant check failed safely.');
        }

        $privileges = trim($matches[1]);
        $scope = trim($matches[2]);
        if ($scope === '*.*') {
            if ($privileges !== 'USAGE') {
                throw new RuntimeException('Worker account has global privileges.');
            }
        } elseif ($scope === 'SYSTEM_BACKEND_TEST.*') {
            $testDatabaseGrantFound = true;
            if (strpos($grant, 'WITH GRANT OPTION') !== false) {
                throw new RuntimeException('Worker account has grant delegation privileges.');
            }
        } else {
            throw new RuntimeException('Worker account has access outside the test database.');
        }
    }
    if (!$testDatabaseGrantFound) {
        throw new RuntimeException('Worker account lacks the expected test database grant.');
    }

    $user = User::findOrFail((int) $userId);
    if (!Court::whereKey((int) $courtId)->exists()) {
        throw new RuntimeException('Worker cannot see the committed court fixture.');
    }
    if ($operation === 'reschedule'
        && !Booking::whereKey($bookingId)->where('user_id', (int) $userId)->exists()) {
        throw new RuntimeException('Worker cannot see its committed booking fixture.');
    }
    Auth::guard('web')->setUser($user);
    Auth::shouldUse('web');

    if (file_put_contents($readyPath, 'ready', LOCK_EX) === false) {
        throw new RuntimeException('Worker could not announce readiness.');
    }

    $gateDeadline = microtime(true) + 30;
    while (!is_file($gatePath)) {
        if (microtime(true) >= $gateDeadline) {
            throw new RuntimeException('Worker timed out at the start gate.');
        }
        usleep(10000);
    }

    $payload = [
        'booking_date' => $bookingDate,
        'start_time' => $startTime,
        'end_time' => $endTime,
    ];
    $method = 'POST';
    $uri = '/api/bookings';

    if ($operation === 'create') {
        $payload = ['court_id' => (int) $courtId] + $payload;
    } else {
        $method = 'PATCH';
        $uri .= '/' . $bookingId . '/reschedule';
    }

    $request = Request::create(
        $uri,
        $method,
        [],
        [],
        [],
        [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
            'HTTP_HOST' => 'localhost',
        ],
        json_encode($payload, JSON_THROW_ON_ERROR)
    );

    $response = $httpKernel->handle($request);
    try {
        $body = json_decode((string) $response->getContent(), true);
        $result['http_status'] = $response->getStatusCode();
        $result['booking_user_id'] = isset($body['data']['user_id'])
            ? (int) $body['data']['user_id']
            : null;
        $result['response_message'] = isset($body['message']) && is_string($body['message'])
            ? $body['message']
            : null;
    } finally {
        $httpKernel->terminate($request, $response);
    }
} catch (Throwable $exception) {
    // Store safe location metadata without exception messages or stack traces.
    $result['worker_error_class'] = get_class($exception);
    $result['worker_error_code'] = is_numeric($exception->getCode())
        ? (int) $exception->getCode()
        : 0;

    $projectRoot = realpath($basePath);
    $exceptionPath = realpath($exception->getFile()) ?: $exception->getFile();
    $projectPrefix = $projectRoot !== false
        ? rtrim($projectRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR
        : '';
    $isInsideProject = $projectPrefix !== '' && (
        DIRECTORY_SEPARATOR === '\\'
            ? strncasecmp($exceptionPath, $projectPrefix, strlen($projectPrefix)) === 0
            : str_starts_with($exceptionPath, $projectPrefix)
    );
    $safeExceptionPath = $isInsideProject
        ? substr($exceptionPath, strlen($projectPrefix))
        : 'external/' . basename($exceptionPath);

    $result['worker_error_file'] = str_replace('\\', '/', $safeExceptionPath);
    $result['worker_error_line'] = (int) $exception->getLine();
    $exitCode = 1;
}

if (!isset($exitCode)) {
    $exitCode = 0;
}

file_put_contents($resultPath, json_encode($result, JSON_INVALID_UTF8_SUBSTITUTE), LOCK_EX);
exit($exitCode);
