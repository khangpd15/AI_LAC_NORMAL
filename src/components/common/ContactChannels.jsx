import React from 'react';

import { contactEmail, contactLinks } from '../../content/contact';

function SocialIcon({ name }) {
  const shapes = {
    facebook: <path fill="currentColor" stroke="none" d="M14 22V13H17L17.5 9H14V7C14 5.9 14.3 5 16 5H18V1.5C17.1 1.2 16 1 15 1C11.8 1 10 2.9 10 6V9H7V13H10V22Z" />,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></>,
    youtube: <><rect x="2" y="5" width="20" height="14" rx="4" /><path d="M10 9L16 12L10 15Z" fill="currentColor" stroke="none" /></>,
    tiktok: <path d="M14 3V16A4 4 0 1 1 10 12M14 3C14 7 17 9 21 9V5C18 5 17 3 17 2H14V3Z" />,
    phone: <path d="m7 3 3 5-2 2c1 3 3 5 6 6l2-2 5 3-1 4C10 22 2 14 3 4Z" />,
    mail: <><rect x="2" y="4" width="20" height="16" rx="3" /><path d="M3 6L12 13L21 6" /></>,
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>;
}

export default function ContactChannels({ className = 'remicare-footer-socials' }) {
  return <div className={className} aria-label="Các kênh liên hệ RemiCare">
    {contactLinks.map(link => {
      const external = link.href.startsWith('https:');
      const label = link.icon === 'mail' ? `Gửi email đến ${contactEmail}` : link.icon === 'phone' ? 'Gọi 0916973161' : `RemiCare trên ${link.name} (mở tab mới)`;
      return <a key={link.icon} href={link.href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} aria-label={label} title={link.name}><SocialIcon name={link.icon} /></a>;
    })}
  </div>;
}
