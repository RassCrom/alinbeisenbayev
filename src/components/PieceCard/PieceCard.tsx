import { useState } from 'react';
import type { PointerEvent } from 'react';
import Frame from '../Frame/Frame';
import Icon from '../Icon/Icon';
import { gallerySrcSet } from '../../data/gallery';
import { cardRatio, firstOfferLabel } from '../../data/works';
import { COVER_SIZES } from '../../utils/images';
import { hasFinePointer, prefersReducedMotion, savesData } from '../../utils/motion';
import type { GalleryItem } from '../../types';

export interface PieceCardProps {
  item: GalleryItem;
  onOpen: (item: GalleryItem) => void;
  /** Load the image eagerly: for a card that is on screen when the page opens. */
  priority?: boolean;
}

/**
 * A finished image or animation on the works index. It has no page of its
 * own, so it is a button that opens the lightbox, not a link.
 *
 * A video shows its poster. Its short silent preview plays only under a
 * mouse, and never for a visitor on data saver or with reduced motion: on
 * touch there is no hover to end it, and the full clip is one tap away.
 */
export default function PieceCard({ item, onOpen, priority = false }: PieceCardProps) {
  const [previewing, setPreviewing] = useState(false);
  const isVideo = item.kind === 'video';
  const label = firstOfferLabel(item.offers ?? []);

  const startPreview = (event: PointerEvent<HTMLButtonElement>) => {
    if (!isVideo || !item.preview || event.pointerType !== 'mouse') return;
    if (!hasFinePointer() || prefersReducedMotion() || savesData()) return;
    setPreviewing(true);
  };

  return (
    <button
      type="button"
      className="piece-card"
      onClick={() => onOpen(item)}
      onPointerEnter={startPreview}
      onPointerLeave={() => setPreviewing(false)}
    >
      <Frame
        src={isVideo ? (item.poster ?? item.src) : item.src}
        srcSet={gallerySrcSet(item)}
        // The title is right below.
        alt=""
        width={item.width}
        height={item.height}
        ratio={String(cardRatio(item.width, item.height))}
        sizes={COVER_SIZES.cardThird}
        priority={priority}
        overlay={
          <>
            {previewing && (
              <video className="piece-card__preview" src={item.preview} muted loop playsInline autoPlay preload="none" />
            )}
            {isVideo && (
              <span className="piece-card__play">
                <Icon name="play" size={16} />
              </span>
            )}
          </>
        }
      />
      <span className="piece-card__text">
        <span className="t-h3">{item.title}</span>
        {label && <span className="t-meta">{label}</span>}
      </span>
    </button>
  );
}
