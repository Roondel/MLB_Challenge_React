import { Star } from 'lucide-react';
import { useState } from 'react';

export default function StarRating({ value = 0, onChange, readonly = false, size = 20 }) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer'}`}
        >
          <Star
            size={size}
            className={
              star <= (hover || value)
                ? 'fill-accent text-accent'
                : 'text-dark-600'
            }
          />
        </button>
      ))}
    </div>
  );
}
