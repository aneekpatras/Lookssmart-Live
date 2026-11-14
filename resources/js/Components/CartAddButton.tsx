import { Check } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/Components/ui/button';
import {
  type AddToCartInput,
  CART_CHANGED_EVENT,
  type CartItem,
  getCartItems,
  isInCart,
  toggleCart,
} from '@/lib/cart';
import { cn } from '@/lib/utils';

/** The live cart, read after mount (never during SSR) and kept in sync with every change. */
export function useCartItems(): CartItem[] {
  const [items, setItems] = React.useState<CartItem[]>([]);

  React.useEffect(() => {
    const refresh = () => setItems(getCartItems());
    refresh();
    window.addEventListener(CART_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CART_CHANGED_EVENT, refresh);
  }, []);

  return items;
}

type CartAddButtonProps = Omit<React.ComponentProps<typeof Button>, 'onClick' | 'children'> & {
  input: AddToCartInput;
  /** The not-added content (icon + text), exactly as the card showed before. */
  children: React.ReactNode;
  /** Size of the check icon in the Added state (match the card's own plus icon). */
  checkClassName?: string;
};

/**
 * One Add to Cart button for every public card: "Add" until the item is in the cart, then the espresso
 * "✓ Added" state (same colours as the booking page's Added pill). Tapping it again removes the item.
 */
export function CartAddButton({
  input,
  children,
  checkClassName = 'size-4',
  className,
  ...props
}: CartAddButtonProps) {
  const added = isInCart(input, useCartItems());
  const name = input.label;

  return (
    <Button
      {...props}
      type="button"
      aria-pressed={added}
      aria-label={added ? `${name}: Added` : undefined}
      className={cn(
        className,
        added && 'bg-ink text-ivory border-ink hover:bg-ink/90 hover:text-ivory',
      )}
      onClick={() => toggleCart(input, toast)}
    >
      {added ? (
        <>
          <Check className={checkClassName} aria-hidden="true" /> Added
        </>
      ) : (
        children
      )}
    </Button>
  );
}
