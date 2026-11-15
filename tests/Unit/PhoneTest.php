<?php

use App\Support\Phone;

it('normalises Pakistani and international numbers to digits with country code', function (string $input, ?string $expected) {
    expect(Phone::normalize($input))->toBe($expected);
})->with([
    ['03001234567', '923001234567'],
    ['0300 123-4567', '923001234567'],
    ['+923001234567', '923001234567'],
    ['923001234567', '923001234567'],
    ['00923001234567', '923001234567'],
    ['+44 7700 900123', '447700900123'],
    ['4477009001', null],
    ['0300123', null],
    ['abc', null],
    ['', null],
    ['+92 2001234567', null],
]);

it('formats a stored number for display', function () {
    expect(Phone::display('923001234567'))->toBe('+92 300 1234567')
        ->and(Phone::display('447700900123'))->toBe('+447700900123');
});
