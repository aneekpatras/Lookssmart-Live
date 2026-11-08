<?php

namespace Database\Seeders;

use App\Models\Review;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Seeds the homepage reviews carousel with the salon's REAL Google reviews (`source = 'google'`),
 * hand-picked by the owner from the live Google Business Profile listing and kept word-for-word
 * (original spelling and punctuation included — nothing is rewritten).
 *
 * Google does not show the star rating in the text that was copied, so every picked review is stored
 * as 5 stars; the owner chose only clearly glowing ones. Check a rating against Google if in doubt.
 *
 * This replaces an earlier set of AUTHORED placeholder "Google" reviews: every `source = 'google'`
 * row that is not in the list below is deleted on each run, so re-running this seeder always leaves
 * exactly this set. Organic (website-submitted) reviews are never touched.
 *
 * `published_at` is approximated from Google's relative dates ("a month ago", "10 months ago"), as
 * Google gives no exact date for a review. Pre-approved and pre-published: no moderation queue.
 *
 * Run on an existing database with: php artisan db:seed --class=GoogleReviewSeeder
 */
class GoogleReviewSeeder extends Seeder
{
    public function run(): void
    {
        $reviews = $this->reviews();

        Review::query()
            ->where('source', 'google')
            ->whereNotIn('reviewer_name', array_column($reviews, 'name'))
            ->delete();

        foreach ($reviews as $review) {
            Review::updateOrCreate(
                ['source' => 'google', 'reviewer_name' => $review['name']],
                [
                    'rating' => 5,
                    'title' => null,
                    'body' => $review['body'],
                    'reviewer_category' => null,
                    'status' => 'approved',
                    'published_at' => Carbon::now()->subDays($review['days_ago']),
                ],
            );
        }
    }

    /**
     * Newest first.
     *
     * @return list<array{name: string, days_ago: int, body: string}>
     */
    private function reviews(): array
    {
        return [
            [
                'name' => 'Fatima Saleem',
                'days_ago' => 28,
                'body' => 'I have been coming here for about one year And I always love her work I wish you all the best for future also ❤️❤️❤️',
            ],
            [
                'name' => 'Irma Umar',
                'days_ago' => 30,
                'body' => "I have been going to Look Smart Salon for almost 10 years, and my experience has always been absolutely amazing! ❤️ She is extremely cooperative, positive, professional, and genuinely dedicated to providing the best services to her clients.\n\nWhat I love most is the attention to detail. She and her staff take proper time with every client, listen carefully, and discuss each and every detail before providing the service. Her makeup and hairstyling are simply 200% perfect! Every time, I leave the salon completely satisfied and happy.\n\nHer staff is also highly professional, well-mannered, and attentive. The quality of service is truly exceptional, especially considering the very reasonable and affordable charges.\n\nIn my opinion, Look Smart Salon is one of the best service providers in Lahore at such reasonable prices. I would highly recommend it to everyone looking for professional, reliable, and excellent beauty services.\n\n2000% HIGHLY RECOMMENDED! ❤️✨",
            ],
            [
                'name' => 'Shakeela Shahzad',
                'days_ago' => 31,
                'body' => 'Had an amazing experience at the salon today. The staff was super friendly and professional, taking their time to understand exactly what I wanted instead of rushing through. The place was spotless, well-maintained, and had a great relaxing vibe. Absolutely loved the final results and will definitely be coming back. Highly recommended to anyone looking for quality service.',
            ],
            [
                'name' => 'Sana Ch.',
                'days_ago' => 32,
                'body' => 'Madam owner is very humble and good in dealing. Services are outstanding. A good saloon in society.',
            ],
            [
                'name' => 'Zainab Arslan',
                'days_ago' => 150,
                'body' => 'Bohat acha experience hai. Services bohat achi hain. Make up bohat acha krti hain. Highly recommended for best services',
            ],
            [
                'name' => 'Hina Ali',
                'days_ago' => 270,
                'body' => 'Very good service and owner is very nice lady my experience is 12 years it was very good',
            ],
            [
                'name' => 'Shazia patras',
                'days_ago' => 300,
                'body' => 'Absolutely loved my experience here! The staff treated me so well and the results were even better than I expected. The salon is clean, relaxing, and very professional. I walked out feeling amazing. Truly the best — highly recommended! ⭐️🤩🤩',
            ],
            [
                'name' => 'Nouman_ SanDhu',
                'days_ago' => 305,
                'body' => 'Absolutely loved my haircut and hair color. Great service and outstanding results. Highly recommended!',
            ],
            [
                'name' => 'Muqdas Abishay',
                'days_ago' => 365,
                'body' => "Amazing service truly satisfied the results\nVery professional and friendly staff loved the experience\nGreat attention to detail and exactly what I asked for Thank you",
            ],
            [
                'name' => 'Mrs Gsvali',
                'days_ago' => 370,
                'body' => 'Best salon in Central park I was vist last 5 year regularly',
            ],
            [
                'name' => 'uzma zaheen',
                'days_ago' => 380,
                'body' => 'Highly recommended, A true professional with magic in her hands 💇‍♀️',
            ],
            [
                'name' => 'mahrukh zahid',
                'days_ago' => 730,
                'body' => 'I am their regular client. Excellent skin care , hair care and polisher services. Must visit for high quality services.',
            ],
        ];
    }
}
