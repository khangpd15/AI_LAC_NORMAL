import { useState, useEffect, useCallback } from 'react';

/**
 * REMICARE - CAMERA COORDINATE TRANSFORM UTILITY
 * Single source of truth for mapping normalized camera coordinates [0, 1]
 * from MediaPipe FaceMesh to the actual DOM display rectangle.
 *
 * Accounts for:
 * 1. CSS object-fit ('cover', 'contain', 'fill')
 * 2. Mirroring (isMirrored: scaleX(-1) selfie mode vs unmirrored)
 * 3. Dynamic video stream aspect ratios (portrait 3:4 / 9:16 vs landscape 4:3 / 16:9)
 * 4. Arbitrary container viewports (fullscreen 100dvh, desktop modal, card view)
 */

/**
 * Computes the exact rendered rectangle of a video element within its display container.
 *
 * @param {HTMLVideoElement|null} videoElement
 * @param {HTMLElement|null} [containerElement=null] - Defaults to videoElement's parentNode if null
 * @returns {{
 *   containerWidth: number,
 *   containerHeight: number,
 *   videoWidth: number,
 *   videoHeight: number,
 *   renderedWidth: number,
 *   renderedHeight: number,
 *   offsetX: number,
 *   offsetY: number,
 *   scaleX: number,
 *   scaleY: number,
 *   objectFit: string,
 * }}
 */
export function getVideoDisplayRect(videoElement, containerElement = null) {
  const container = containerElement || videoElement?.parentElement || null;

  const videoWidth = Number(videoElement?.videoWidth) || 640;
  const videoHeight = Number(videoElement?.videoHeight) || 480;

  const containerWidth =
    Number(container?.clientWidth) ||
    Number(videoElement?.clientWidth) ||
    videoWidth;
  const containerHeight =
    Number(container?.clientHeight) ||
    Number(videoElement?.clientHeight) ||
    videoHeight;

  let objectFit = 'cover';
  if (typeof window !== 'undefined' && videoElement) {
    try {
      const computed = window.getComputedStyle(videoElement);
      objectFit = computed.objectFit || 'cover';
    } catch {
      objectFit = 'cover';
    }
  }

  const vRatio = videoWidth / Math.max(1, videoHeight);
  const cRatio = containerWidth / Math.max(1, containerHeight);

  let renderedWidth = containerWidth;
  let renderedHeight = containerHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (objectFit === 'cover') {
    if (vRatio > cRatio) {
      // Video is wider than container: container height determines scale, width is cropped equally
      renderedHeight = containerHeight;
      renderedWidth = Number((containerHeight * vRatio).toFixed(2));
      offsetX = Number(((containerWidth - renderedWidth) / 2).toFixed(2));
      offsetY = 0;
    } else {
      // Video is taller than container: container width determines scale, height is cropped equally
      renderedWidth = containerWidth;
      renderedHeight = Number((containerWidth / vRatio).toFixed(2));
      offsetX = 0;
      offsetY = Number(((containerHeight - renderedHeight) / 2).toFixed(2));
    }
  } else if (objectFit === 'contain') {
    if (vRatio > cRatio) {
      // Letterbox (bars top/bottom)
      renderedWidth = containerWidth;
      renderedHeight = Number((containerWidth / vRatio).toFixed(2));
      offsetX = 0;
      offsetY = Number(((containerHeight - renderedHeight) / 2).toFixed(2));
    } else {
      // Pillarbox (bars left/right)
      renderedHeight = containerHeight;
      renderedWidth = Number((containerHeight * vRatio).toFixed(2));
      offsetX = Number(((containerWidth - renderedWidth) / 2).toFixed(2));
      offsetY = 0;
    }
  } else {
    // 'fill' or default stretch
    renderedWidth = containerWidth;
    renderedHeight = containerHeight;
    offsetX = 0;
    offsetY = 0;
  }

  return {
    containerWidth,
    containerHeight,
    videoWidth,
    videoHeight,
    renderedWidth,
    renderedHeight,
    offsetX,
    offsetY,
    scaleX: renderedWidth / Math.max(1, videoWidth),
    scaleY: renderedHeight / Math.max(1, videoHeight),
    objectFit,
  };
}

/**
 * Maps a normalized point { x, y } in [0, 1] (MediaPipe frame coordinates)
 * to container pixel and percentage coordinates.
 *
 * @param {{ x: number, y: number }|null} normPoint
 * @param {ReturnType<typeof getVideoDisplayRect>} displayRect
 * @param {boolean} [isMirrored=true] - True for standard scaleX(-1) mirror view
 * @returns {{ x: number, y: number, xPercent: number, yPercent: number }}
 */
export function mapCameraPointToDisplay(normPoint, displayRect, isMirrored = true) {
  if (!normPoint || !displayRect || !Number.isFinite(normPoint.x) || !Number.isFinite(normPoint.y)) {
    return { x: 0, y: 0, xPercent: 50, yPercent: 50 };
  }

  const effectiveX = isMirrored ? 1.0 - normPoint.x : normPoint.x;

  const xPixel = Number((displayRect.offsetX + effectiveX * displayRect.renderedWidth).toFixed(2));
  const yPixel = Number((displayRect.offsetY + normPoint.y * displayRect.renderedHeight).toFixed(2));

  const xPercent = displayRect.containerWidth > 0
    ? Number(((xPixel / displayRect.containerWidth) * 100).toFixed(2))
    : 50;
  const yPercent = displayRect.containerHeight > 0
    ? Number(((yPixel / displayRect.containerHeight) * 100).toFixed(2))
    : 50;

  return {
    x: xPixel,
    y: yPixel,
    xPercent,
    yPercent,
  };
}

/**
 * Maps a normalized bounding box { xMin, yMin, width, height } in [0, 1]
 * to container pixel and percentage coordinates.
 *
 * @param {{ xMin: number, yMin: number, width: number, height: number }|null} normRect
 * @param {ReturnType<typeof getVideoDisplayRect>} displayRect
 * @param {boolean} [isMirrored=true]
 * @returns {{
 *   left: number,
 *   top: number,
 *   width: number,
 *   height: number,
 *   leftPercent: number,
 *   topPercent: number,
 *   widthPercent: number,
 *   heightPercent: number,
 * }|null}
 */
export function mapCameraRectToDisplay(normRect, displayRect, isMirrored = true) {
  if (!normRect || !displayRect) return null;

  const widthPixel = Number((normRect.width * displayRect.renderedWidth).toFixed(2));
  const heightPixel = Number((normRect.height * displayRect.renderedHeight).toFixed(2));

  const effectiveXMin = isMirrored
    ? 1.0 - (normRect.xMin + normRect.width)
    : normRect.xMin;

  const leftPixel = Number((displayRect.offsetX + effectiveXMin * displayRect.renderedWidth).toFixed(2));
  const topPixel = Number((displayRect.offsetY + normRect.yMin * displayRect.renderedHeight).toFixed(2));

  const leftPercent = displayRect.containerWidth > 0
    ? Number(((leftPixel / displayRect.containerWidth) * 100).toFixed(2))
    : 0;
  const topPercent = displayRect.containerHeight > 0
    ? Number(((topPixel / displayRect.containerHeight) * 100).toFixed(2))
    : 0;
  const widthPercent = displayRect.containerWidth > 0
    ? Number(((widthPixel / displayRect.containerWidth) * 100).toFixed(2))
    : 0;
  const heightPercent = displayRect.containerHeight > 0
    ? Number(((heightPixel / displayRect.containerHeight) * 100).toFixed(2))
    : 0;

  return {
    left: leftPixel,
    top: topPixel,
    width: widthPixel,
    height: heightPixel,
    leftPercent,
    topPercent,
    widthPercent,
    heightPercent,
  };
}

/**
 * React hook to keep the video display rect continuously synchronized with DOM resizes.
 *
 * @param {React.RefObject<HTMLVideoElement>} videoRef
 * @param {React.RefObject<HTMLElement>} [containerRef]
 * @returns {ReturnType<typeof getVideoDisplayRect>}
 */
export function useCameraDisplayRect(videoRef, containerRef = null) {
  const [displayRect, setDisplayRect] = useState(() =>
    getVideoDisplayRect(null, null)
  );

  const updateRect = useCallback(() => {
    const video = videoRef?.current || null;
    const container = containerRef?.current || video?.parentElement || null;
    if (video) {
      setDisplayRect(getVideoDisplayRect(video, container));
    }
  }, [videoRef, containerRef]);

  useEffect(() => {
    updateRect();

    const video = videoRef?.current;
    const container = containerRef?.current || video?.parentElement;

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && container) {
      resizeObserver = new ResizeObserver(() => updateRect());
      resizeObserver.observe(container);
      if (video && video !== container) {
        resizeObserver.observe(video);
      }
    }

    if (video) {
      video.addEventListener('resize', updateRect);
      video.addEventListener('loadedmetadata', updateRect);
      video.addEventListener('canplay', updateRect);
    }

    window.addEventListener('resize', updateRect);

    // iOS Safari WebRTC streams often change resolution (e.g. initial 640x480 SDP -> actual 480x640 portrait stream)
    // without firing 'resize' or 'loadedmetadata'. Periodic polling ensures displayRect reflects real dimensions.
    const pollInterval = setInterval(() => {
      const v = videoRef?.current;
      if (v && v.videoWidth > 0 && v.videoHeight > 0) {
        setDisplayRect((prev) => {
          if (prev.videoWidth !== v.videoWidth || prev.videoHeight !== v.videoHeight) {
            const cont = containerRef?.current || v.parentElement || null;
            return getVideoDisplayRect(v, cont);
          }
          return prev;
        });
      }
    }, 250);

    return () => {
      clearInterval(pollInterval);
      if (resizeObserver) resizeObserver.disconnect();
      if (video) {
        video.removeEventListener('resize', updateRect);
        video.removeEventListener('loadedmetadata', updateRect);
        video.removeEventListener('canplay', updateRect);
      }
      window.removeEventListener('resize', updateRect);
    };
  }, [videoRef, containerRef, updateRect]);

  return displayRect;
}
