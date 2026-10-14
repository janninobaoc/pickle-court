<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use App\Support\TestingDatabaseSafety;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Foundation\Testing\RefreshDatabase;

abstract class TestCase extends BaseTestCase
{
    public function createApplication()
    {
        $app = parent::createApplication();

        $traits = class_uses_recursive(static::class);
        $databaseSetupTraits = [
            DatabaseMigrations::class,
            DatabaseTransactions::class,
            DatabaseTruncation::class,
            LazilyRefreshDatabase::class,
            RefreshDatabase::class,
        ];

        if ($app->environment('testing') && array_intersect($databaseSetupTraits, array_keys($traits)) !== []) {
            TestingDatabaseSafety::assertSafe($app);
        }

        return $app;
    }
}
