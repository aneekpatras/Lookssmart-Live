<?php

namespace App\Support;

use App\Models\Setting;
use Throwable;

/**
 * Which Google tag (if any) the public pages should load. One source for the Blade head, the Blade
 * noscript fallback and the CSP, so they can never disagree. Fails closed: any problem reading
 * settings (table missing, database down) means "no tag", never an error.
 *
 * Settings: analytics.enabled (default on) and analytics.gtm_id (default DEFAULT_ID). A GTM-... id
 * loads gtm.js; a G-... id loads gtag.js. Never on /admin*, never in the local environment.
 */
class Analytics
{
    public const DEFAULT_ID = 'GTM-WJLPSKGR';

    public const GTM_PATTERN = '/^GTM-[A-Z0-9]{4,12}$/';

    public const GA_PATTERN = '/^G-[A-Z0-9]{6,14}$/';

    /** @return array{id:string,kind:'gtm'|'ga'}|null */
    public static function tag(): ?array
    {
        try {
            if (app()->environment('local') || request()->is('admin*')) {
                return null;
            }
            if (Setting::get('analytics.enabled') === false) {
                return null;
            }

            $id = strtoupper(trim((string) Setting::get('analytics.gtm_id')));
            $id = $id !== '' ? $id : self::DEFAULT_ID;

            if (preg_match(self::GTM_PATTERN, $id)) {
                return ['id' => $id, 'kind' => 'gtm'];
            }
            if (preg_match(self::GA_PATTERN, $id)) {
                return ['id' => $id, 'kind' => 'ga'];
            }
        } catch (Throwable) {
            // Settings unavailable: no analytics.
        }

        return null;
    }
}
