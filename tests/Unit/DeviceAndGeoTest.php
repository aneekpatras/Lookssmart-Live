<?php

use App\Support\DeviceParser;
use App\Support\GeoLocator;
use App\Support\TrafficSource;

it('parses device, browser, OS and bots from a user agent', function (string $ua, string $device, string $browser, string $os, bool $bot) {
    expect(DeviceParser::parse($ua))->toBe(['device_type' => $device, 'browser' => $browser, 'os' => $os, 'is_bot' => $bot]);
})->with([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', 'mobile', 'Safari', 'iOS', false],
    ['Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36', 'mobile', 'Samsung Internet', 'Android', false],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0', 'desktop', 'Edge', 'Windows', false],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; rv:121.0) Gecko/20100101 Firefox/121.0', 'desktop', 'Firefox', 'macOS', false],
    ['Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1', 'tablet', 'Safari', 'iOS', false],
    ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'desktop', 'other', 'other', true],
    ['curl/8.4.0', 'desktop', 'other', 'other', true],
    ['', 'desktop', 'other', 'other', true],
]);

it('returns nulls without a geo database and Local network for private addresses', function () {
    if (GeoLocator::available()) {
        $this->markTestSkipped('A real GeoLite2 file is present.');
    }

    expect(GeoLocator::lookup('8.8.8.8'))->toBe(['country' => null, 'region' => null, 'city' => null])
        ->and(GeoLocator::lookup('10.0.0.5'))->toBe(['country' => null, 'region' => null, 'city' => 'Local network'])
        ->and(GeoLocator::lookup('127.0.0.1')['city'])->toBe('Local network')
        ->and(GeoLocator::lookup(null))->toBe(['country' => null, 'region' => null, 'city' => null]);
});

it('labels the traffic source', function () {
    expect(TrafficSource::label('l.instagram.com'))->toBe('Instagram')
        ->and(TrafficSource::label('www.google.com'))->toBe('Google')
        ->and(TrafficSource::label('', 'whatsapp'))->toBe('WhatsApp')
        ->and(TrafficSource::label('some-blog.pk'))->toBe('some-blog.pk')
        ->and(TrafficSource::label('lookssmart.test', null, null, null, 'lookssmart.test'))->toBe('Direct')
        ->and(TrafficSource::label(null))->toBe('Direct');
});
