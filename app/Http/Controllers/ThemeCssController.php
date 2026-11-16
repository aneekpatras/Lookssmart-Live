<?php

namespace App\Http\Controllers;

use App\Support\Theme;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** GET /theme.css: the saved theme colours as a stylesheet. Never errors; empty when nothing custom is saved. */
class ThemeCssController extends Controller
{
    public function __invoke(Request $request): Response
    {
        try {
            $css = Theme::css();
        } catch (\Throwable) {
            $css = "/* Default theme */\n";
        }

        $etag = '"' . md5($css) . '"';

        $response = response($css, $request->header('If-None-Match') === $etag ? 304 : 200, [
            'Content-Type' => 'text/css; charset=UTF-8',
            'Cache-Control' => 'public, max-age=3600',
            'ETag' => $etag,
        ]);

        return $response;
    }
}
