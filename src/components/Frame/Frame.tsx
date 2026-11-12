import { useEffect, useRef, useState } from 'react';
import Skeleton from '../Skeleton/Skeleton';
import { coverSrcSet } from '../../utils/images';

export interface FrameProps {
  src: string;
  alt: string;
  /** Intrinsic size. Sets the reserved aspect ratio unless `ratio` is given. */
  width: number;
  height: number;
  /** e.g. '16 / 9'. The image then covers the box. */
  ratio?: string;
  sizes?: string;
  /** The small radius set: 12 outer, 4 padding, 8 inner. */
  small?: boolean;
  /** Load eagerly at high priority. For the one image a page leads with. */
  priority?: boolean;
  viewTransitionName?: string;
}

/**
 * The padded holder every cover sits in. It reserves the image's space
 * before a byte of it has arrived, shows a skeleton meanwhile and fades the
 * image in, so a page never jumps as its covers load.
 */
export default function Frame({
  src,
  alt,
  width,
  height,
  ratio,
  sizes,
  small = false,
  priority = false,
  viewTransitionName,
}: FrameProps) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // A cached image can finish before React attaches onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) setLoaded(true);
  }, [src]);

  return (
    <div className={small ? 'frame frame--sm' : 'frame'}>
      <div className="frame__media" style={{ aspectRatio: ratio ?? `${width} / ${height}` }}>
        {!loaded && <Skeleton className="frame__skeleton" />}
        <img
          ref={imgRef}
          src={src}
          srcSet={coverSrcSet(src)}
          sizes={sizes}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          // React 18 has no camelCase prop for this attribute.
          {...{ fetchpriority: priority ? 'high' : undefined }}
          data-loaded={loaded}
          onLoad={() => setLoaded(true)}
          // A broken image still has to show its alt text.
          onError={() => setLoaded(true)}
          style={viewTransitionName ? { viewTransitionName } : undefined}
        />
      </div>
    </div>
  );
}
