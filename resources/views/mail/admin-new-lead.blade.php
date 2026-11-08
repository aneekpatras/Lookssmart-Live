@extends('mail.layout')

@section('content')
    <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#1d1d1d;">New Contact Enquiry</h1>
    <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#4f4a46;">
        Someone just submitted the website contact form.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; background:#faf6f1; border:1px solid #f0e5d7; border-radius:12px; margin-bottom:24px;">
        <tr>
            <td style="padding:20px 18px; font-size:14px; color:#413d38; line-height:1.7;">
                <strong style="color:#1d1d1d;">Name:</strong> {{ $lead_name }}<br>
                <strong style="color:#1d1d1d;">Phone:</strong> {{ $lead_phone }}<br>
                <strong style="color:#1d1d1d;">Email:</strong> {{ $lead_email ?: '—' }}<br>
                <strong style="color:#1d1d1d;">Message:</strong><br>
                <span style="white-space:pre-line;">{{ $lead_notes }}</span>
            </td>
        </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
            <td align="center" bgcolor="#c9a66b" style="border-radius:999px;">
                <a href="{{ $cta_url }}" style="display:inline-block; padding:14px 24px; font-size:15px; font-weight:bold; color:#1d1d1d; text-decoration:none;">View lead in admin dashboard</a>
            </td>
        </tr>
    </table>
@endsection
