<?php

namespace Tests\Unit;

use Illuminate\Contracts\Foundation\Application as ApplicationContract;
use Illuminate\Contracts\Encryption\Encrypter;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\Request;
use Illuminate\Session\ArraySessionHandler;
use Illuminate\Session\Store;
use Illuminate\Session\TokenMismatchException;
use Tests\TestCase;

class SanctumCsrfMiddlewareTest extends TestCase
{
    public function test_unsafe_request_without_a_csrf_token_is_rejected_outside_console_context(): void
    {
        $application = $this->createMock(ApplicationContract::class);
        $application->expects($this->once())
            ->method('runningInConsole')
            ->willReturn(false);

        $session = new Store('csrf-test-session', new ArraySessionHandler(120));
        $session->start();

        $request = Request::create('/api/login', 'POST');
        $request->setLaravelSession($session);

        $middleware = new ValidateCsrfToken($application, app(Encrypter::class));

        $this->expectException(TokenMismatchException::class);
        $middleware->handle($request, static fn () => response('should not execute'));
    }
}
