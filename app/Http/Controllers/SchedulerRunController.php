<?php

namespace App\Http\Controllers;

use App\Services\SettingService;
use Illuminate\Support\Facades\Artisan;

/**
 * Secret trigger URL for hosts whose cron panel cannot run artisan: an outside cron service (or the
 * host's Scheduled Tasks, with wget/curl) calls GET /scheduler/run/{token} every few minutes and this
 * runs `schedule:run`. The token lives in the encrypted setting scheduler.token (generated in
 * Admin > Reminders > Email rules). No token set or a wrong one is a plain 404. The token is never
 * logged or echoed.
 */
class SchedulerRunController extends Controller
{
    public function __invoke(string $token)
    {
        try {
            $stored = (string) app(SettingService::class)->get('scheduler.token');
        } catch (\Throwable) {
            $stored = '';
        }

        abort_if($stored === '' || ! hash_equals($stored, $token), 404);

        try {
            Artisan::call('schedule:run');
        } catch (\Throwable) {
            // The caller only needs to know the trigger was accepted; failures show in the scheduler's own logs.
        }

        return response('ok', 200, ['Content-Type' => 'text/plain', 'Cache-Control' => 'no-store']);
    }
}
