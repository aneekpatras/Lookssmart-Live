<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BulkReviewActionRequest;
use App\Http\Requests\Admin\ReplyToReviewRequest;
use App\Http\Requests\Admin\StoreGoogleReviewRequest;
use App\Models\Review;
use App\Models\Staff;
use App\Notifications\ReviewStatusUpdated;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ReviewController extends Controller
{
    public function index(Request $request): Response
    {
        // Not ReviewPolicy::viewAny() — that's deliberately open (the public site lists approved
        // reviews without authorization). The admin moderation queue needs a real gate.
        abort_unless($request->user()->can('crm.manage'), 403);

        $reviews = Review::query()
            ->with(['customer:id,name', 'service:id,name', 'booking:id,code,staff_id', 'booking.staff.user:id,name'])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->when($request->filled('rating'), fn ($query) => $query->where('rating', $request->integer('rating')))
            ->when($request->filled('verified'), fn ($query) => $request->boolean('verified')
                ? $query->whereNotNull('booking_id')
                : $query->whereNull('booking_id'))
            ->when($request->filled('staff_id'), fn ($query) => $query->whereHas(
                'booking',
                fn ($query) => $query->where('staff_id', $request->integer('staff_id')),
            ))
            ->latest()
            ->get();

        return Inertia::render('Admin/CRM/Reviews/Index', [
            'reviews' => $reviews->map(fn (Review $review) => $this->reviewData($review)),
            // Everything the homepage carousel can show, in the exact order it shows it: the
            // drag-to-reorder list at the top of the page.
            'homepageOrder' => Review::query()
                ->with(['customer:id,name'])
                ->where('status', 'approved')
                ->whereNotNull('published_at')
                ->orderBy('sort')
                ->latest('published_at')
                ->get()
                ->map(fn (Review $review) => [
                    'id' => $review->id,
                    'rating' => $review->rating,
                    'body' => $review->body,
                    'name' => $review->display_name,
                    'source' => $review->source,
                ]),
            'staffOptions' => Staff::active()->with('user:id,name')->get()->map(fn (Staff $staff) => [
                'id' => $staff->id,
                'name' => $staff->user?->name ?? 'Team member',
            ]),
            'stats' => [
                'pending' => Review::where('status', 'pending')->count(),
                'approved' => Review::where('status', 'approved')->count(),
                'rejected' => Review::where('status', 'rejected')->count(),
            ],
            'filters' => [
                'status' => $request->string('status')->value() ?: null,
                'rating' => $request->integer('rating') ?: null,
                'verified' => $request->filled('verified') ? $request->boolean('verified') : null,
                'staff_id' => $request->integer('staff_id') ?: null,
            ],
        ]);
    }

    /** Adds a review the owner copied from Google (name, stars, text); it goes live at once. */
    public function store(StoreGoogleReviewRequest $request): RedirectResponse
    {
        $data = $request->validated();

        Review::create([
            'reviewer_name' => trim(strip_tags($data['reviewer_name'])),
            'rating' => $data['rating'],
            'body' => trim(strip_tags($data['body'])),
            'source' => 'google',
            'status' => 'approved',
            'published_at' => isset($data['published_at']) ? Carbon::parse($data['published_at']) : now(),
        ]);

        return back()->with('success', 'Google review added to the homepage.');
    }

    /**
     * Saves the drag-and-drop homepage order: the submitted ids become sort 1..n in that order.
     * Reviews not in the list (pending/hidden) keep their old value; it does not matter for them.
     */
    public function reorder(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('crm.manage'), 403);

        $data = $request->validate([
            'order' => ['required', 'array'],
            'order.*' => ['integer', 'distinct', 'exists:reviews,id'],
        ]);

        DB::transaction(function () use ($data) {
            foreach (array_values($data['order']) as $index => $id) {
                Review::whereKey($id)->update(['sort' => $index + 1]);
            }
        });

        return back()->with('success', 'Homepage order saved.');
    }

    public function approve(Review $review): RedirectResponse
    {
        $this->authorize('update', $review);

        $review->update([
            'status' => 'approved',
            'published_at' => $review->published_at ?? now(),
        ]);

        $this->notifyCustomer($review, 'approved');

        return back()->with('success', 'Review approved.');
    }

    public function reject(Review $review): RedirectResponse
    {
        $this->authorize('update', $review);

        $review->update(['status' => 'rejected']);

        return back()->with('success', 'Review rejected.');
    }

    public function reply(ReplyToReviewRequest $request, Review $review): RedirectResponse
    {
        $review->update(['admin_reply' => $request->validated('admin_reply')]);

        $this->notifyCustomer($review, 'replied');

        return back()->with('success', 'Reply posted.');
    }

    public function bulkAction(BulkReviewActionRequest $request): RedirectResponse
    {
        $reviews = Review::whereIn('id', $request->validated('ids'))->get();
        $action = $request->validated('action');

        foreach ($reviews as $review) {
            if ($action === 'approve') {
                $review->update(['status' => 'approved', 'published_at' => $review->published_at ?? now()]);
                $this->notifyCustomer($review, 'approved');
            } elseif ($action === 'reject') {
                $review->update(['status' => 'rejected']);
            } else {
                $review->delete();
            }
        }

        return back()->with('success', 'Reviews updated.');
    }

    public function destroy(Review $review): RedirectResponse
    {
        $this->authorize('delete', $review);

        $review->delete();

        return back()->with('success', 'Review deleted.');
    }

    private function notifyCustomer(Review $review, string $event): void
    {
        $customer = $review->customer;

        if ($customer) {
            $customer->notify(new ReviewStatusUpdated($review, $event));
        }
    }

    /** @return array<string, mixed> */
    private function reviewData(Review $review): array
    {
        return [
            'id' => $review->id,
            'rating' => $review->rating,
            'title' => $review->title,
            'body' => $review->body,
            'status' => $review->status,
            'admin_reply' => $review->admin_reply,
            'published_at' => $review->published_at?->toIso8601String(),
            'customer_name' => $review->customer?->name,
            'service_name' => $review->service?->name,
            'booking_code' => $review->booking?->code,
            'staff_name' => $review->booking?->staff?->user?->name,
            'display_name' => $review->display_name,
            'source' => $review->source,
            'is_verified' => $review->booking_id !== null,
            'created_at' => $review->created_at?->toIso8601String(),
        ];
    }
}
