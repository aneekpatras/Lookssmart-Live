import { AutoMarquee } from '@/Components/AutoMarquee';

export interface MarqueeImage {
  id: number | string;
  url: string;
  webp_url?: string | null;
  alt: string;
}

interface BridalMarqueeProps {
  images: MarqueeImage[];
}

/**
 * Auto-scrolling bridal photo marquee. The scrolling engine (endless loop, hover/touch/focus pause,
 * reduced-motion handling) lives in `AutoMarquee`; this only supplies the photo cards.
 */
export function BridalMarquee({ images }: BridalMarqueeProps) {
  return (
    <AutoMarquee
      count={images.length}
      secondsPerCard={3}
      renderItem={(index, duplicate) => {
        const image = images[index];
        return image ? <MarqueeCard image={image} duplicate={duplicate} /> : null;
      }}
    />
  );
}

function MarqueeCard({ image, duplicate = false }: { image: MarqueeImage; duplicate?: boolean }) {
  return (
    <li
      className="w-[38vw] max-w-[190px] shrink-0 sm:w-[264px] sm:max-w-none"
      aria-hidden={duplicate ? 'true' : undefined}
    >
      <div className="shadow-soft bg-accent-50 aspect-[3/4] overflow-hidden rounded-2xl">
        {/* <picture> so an uploaded image's generated .webp sibling is preferred where one exists,
            with the original as the fallback source — same pattern as the gallery page. */}
        <picture>
          {image.webp_url && <source srcSet={image.webp_url} type="image/webp" />}
          <img
            src={image.url}
            alt={duplicate ? '' : image.alt}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="size-full object-cover"
          />
        </picture>
      </div>
    </li>
  );
}
