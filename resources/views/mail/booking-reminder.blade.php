@extends('mail.layout')

@section('content')
    @if (!empty($test))
        <p style="margin:0 0 16px; padding:8px 12px; background:#fff4d6; border-radius:8px; font-size:13px; color:#6b4f00;">This is a test reminder sent only to you. Nothing was sent to a customer.</p>
    @endif
    <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#1d1d1d;">Your Appointment Is Coming Up</h1>
    <p style="margin:0 0 20px; font-size:16px; line-height:1.7; color:#4f4a46;">
        Hi {{ $customer_name ?? 'there' }},
    </p>
    <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#4f4a46;">
        @if (!empty($lead))
            Your appointment at Looks Smart Beauty Salon is in {{ $lead }}.
        @else
            A quick reminder about your appointment at Looks Smart Beauty Salon.
        @endif
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; background:#faf6f1; border:1px solid #f0e5d7; border-radius:12px; margin-bottom:24px;">
        <tr>
            <td style="padding:20px 18px; font-size:14px; color:#413d38; line-height:1.7;">
                <strong style="color:#1d1d1d;">Booking:</strong> {{ $booking_code }}<br>
                <strong style="color:#1d1d1d;">When:</strong> {{ $when }}<br>
                <strong style="color:#1d1d1d;">Services:</strong>
                @if (!empty($services))
                    {{ implode(', ', $services) }}
                @else
                    —
                @endif
                <br>
                <strong style="color:#1d1d1d;">Total:</strong> {{ $total }}
                @if (!empty($address))
                    <br><strong style="color:#1d1d1d;">Where:</strong> {{ $address }}
                @endif
                @if (!empty($phone))
                    <br><strong style="color:#1d1d1d;">Call us:</strong> {{ $phone }}
                @endif
            </td>
        </tr>
    </table>

    @if (!empty($confirm_url))
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
        <tr>
            <td align="center" bgcolor="#c9a66b" style="border-radius:999px;">
                <a href="{{ $confirm_url }}" style="display:inline-block; padding:16px 32px; font-size:17px; font-weight:bold; color:#1d1d1d; text-decoration:none;">Confirm my booking</a>
            </td>
        </tr>
    </table>
    @endif
    @if (!empty($reschedule_url) || !empty($cancel_url))
        <p style="margin:0 0 20px; font-size:14px; line-height:1.7; color:#4f4a46;">
            @if (!empty($reschedule_url))
                <a href="{{ $reschedule_url }}" style="color:#8a6a34;">Reschedule</a>
            @endif
            @if (!empty($reschedule_url) && !empty($cancel_url))
                &nbsp;|&nbsp;
            @endif
            @if (!empty($cancel_url))
                <a href="{{ $cancel_url }}" style="color:#6d655f; font-size:13px;">Cancel booking</a>
            @endif
        </p>
    @endif

    @if (!empty($policy))
        <p style="margin:0 0 20px; font-size:13px; line-height:1.7; color:#6d655f;">{{ $policy }}</p>
    @endif

    <p style="margin:0; font-size:13px; line-height:1.7; color:#6d655f;">
        We’ll see you soon — please arrive 5–10 minutes early if you can.
    </p>
@endsection
