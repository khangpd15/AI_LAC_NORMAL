import React, { useState } from 'react';
import { sitePhotos } from '../../content/sitePhotos';

export default function SitePhoto({ name, hero = false, decorative = false }) {
  const photo = sitePhotos[name];
  const [failed, setFailed] = useState(false);
  return <span className="site-photo" data-missing={failed || undefined} style={{ '--photo-ratio': `${photo.width} / ${photo.height}`, '--photo-position': photo.position }}>
    <img
      src={photo.src}
      alt={decorative ? '' : photo.alt}
      width={photo.width}
      height={photo.height}
      loading={hero ? 'eager' : 'lazy'}
      fetchPriority={hero ? 'high' : undefined}
      decoding="async"
      onError={() => setFailed(true)}
      style={failed ? { visibility: 'hidden' } : undefined}
    />
  </span>;
}
