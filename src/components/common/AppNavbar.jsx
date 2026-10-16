import React, { useEffect, useId, useRef, useState } from 'react';
import { AudioIcon } from '../audio/ListeningExperience';
import {
  IconNavHome,
  IconNavEye,
  IconNavSimulation,
  IconNavCamera,
  IconNavAbout,
  SvgGradients,
} from '../home/HomeIcons';
import './appNavbar.css';

/**
 * REMICARE AI — UNIFIED MASTER APPLICATION NAVBAR
 * 
 * Thống nhất 1 mẫu giao diện chuẩn duy nhất xuyên suốt:
 * - Trang chủ (Home)
 * - Trải nghiệm (Experience)
 * - Mô phỏng lác lé AI (Simulation)
 * - Sàng lọc hai mắt (Screening)
 * - Giới thiệu (About)
 * 
 * Luôn ghim cố định (Sticky) ở đỉnh màn hình với hiệu ứng kính mờ (glassmorphism),
 * thiết kế nút bấm chuẩn trợ năng cho mọi thế hệ (Trẻ em, Phụ huynh & Người cao tuổi).
 */
export default function AppNavbar({
  activeTab = 'home',
  onSelectTab,
  onNavigateHome,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuId = useId();
  const mobileMenuRef = useRef(null);
  const [dark, setDark] = useState(() => {
    try { return (localStorage.getItem('remicare-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark'; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('remicare-theme', dark ? 'dark' : 'light'); } catch { /* Storage can be unavailable in private mode. */ }
  }, [dark]);
  const handleBrandClick = () => {
    setMobileOpen(false);
    if (activeTab === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (onNavigateHome) {
      onNavigateHome();
    } else if (onSelectTab) {
      onSelectTab('home');
    }
  };

  const handleTabClick = (tabKey) => {
    setMobileOpen(false);
    if (activeTab === tabKey) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (onSelectTab) {
      onSelectTab(tabKey);
    }
  };

  return (
    <>
      <SvgGradients />
      <header className="remicare-unified-navbar" data-mobile-open={mobileOpen} onKeyDown={event => { if (event.key === 'Escape' && mobileOpen) { setMobileOpen(false); mobileMenuRef.current?.focus(); } }} role="banner" aria-label="Thanh điều hướng chính RemiCare AI">
        <div className="unified-navbar-inner">
          {/* Brand Logo & Title */}
          <div
            className="unified-navbar-brand"
            onClick={handleBrandClick}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleBrandClick(); } }}
            title="Về Trang chủ RemiCare AI"
            aria-label="RemiCare AI — Trang chủ"
          >
            <img
              src="/images/logo.jpg"
              alt="Logo RemiCare AI"
              className="unified-brand-logo-img"
            />
            <div className="unified-brand-text">
              <span className="unified-brand-title">RemiCare AI</span>
              <span className="unified-brand-subtitle">AI CHĂM SÓC MẮT CỘNG ĐỒNG</span>
            </div>
          </div>

          {/* 5 Navigation Tabs (Unified Across All Views) */}
          <nav id={menuId} className="unified-navbar-nav" aria-label="Các trang chính">
            <ul className="unified-navbar-items">
              <li>
                <button
                  type="button"
                  
                  aria-current={activeTab === 'home' ? 'page' : undefined}
                  className={`unified-nav-btn ${activeTab === 'home' ? 'active' : ''}`}
                  onClick={() => handleTabClick('home')}
                  title="Trang chủ RemiCare"
                >
                  <span className="unified-nav-icon" aria-hidden="true">
                    <IconNavHome size={20} />
                  </span>
                  <span>Trang chủ</span>
                </button>
              </li>

              <li>
                <button
                  type="button"
                  
                  aria-current={activeTab === 'experience' ? 'page' : undefined}
                  className={`unified-nav-btn ${activeTab === 'experience' ? 'active' : ''}`}
                  onClick={() => handleTabClick('experience')}
                  title="Trải nghiệm góc nhìn thị giác"
                >
                  <span className="unified-nav-icon" aria-hidden="true">
                    <IconNavEye size={20} />
                  </span>
                  <span>Trải nghiệm</span>
                </button>
              </li>

              <li>
                <button
                  type="button"
                  
                  aria-current={activeTab === 'simulation' ? 'page' : undefined}
                  className={`unified-nav-btn ${activeTab === 'simulation' ? 'active' : ''}`}
                  onClick={() => handleTabClick('simulation')}
                  title="Mô phỏng mắt lác lé bằng AI Webcam trực tiếp"
                >
                  <span className="unified-nav-icon" aria-hidden="true">
                    <IconNavSimulation size={20} />
                  </span>
                  <span>Mô phỏng lác lé</span>
                  <span className="unified-nav-badge-new">AI Cam</span>
                </button>
              </li>

              <li>
                <button
                  type="button"
                  
                  aria-current={activeTab === 'screening' ? 'page' : undefined}
                  className={`unified-nav-btn ${activeTab === 'screening' ? 'active' : ''}`}
                  onClick={() => handleTabClick('screening')}
                  title="Bài kiểm tra sàng lọc thị lực hai mắt"
                >
                  <span className="unified-nav-icon" aria-hidden="true">
                    <IconNavCamera size={20} />
                  </span>
                  <span>Sàng lọc</span>
                </button>
              </li>

              <li>
                <button
                  type="button"
                  
                  aria-current={activeTab === 'about' ? 'page' : undefined}
                  className={`unified-nav-btn ${activeTab === 'about' ? 'active' : ''}`}
                  onClick={() => handleTabClick('about')}
                  title="Giới thiệu sứ mệnh và 4 trụ cột công nghệ RemiCare"
                >
                  <span className="unified-nav-icon" aria-hidden="true">
                    <IconNavAbout size={20} />
                  </span>
                  <span>Giới thiệu</span>
                </button>
              </li>
            </ul>
          </nav>
          <button className="care-theme-toggle" onClick={() => setDark((value) => !value)} aria-label={dark ? 'Bật giao diện sáng' : 'Bật giao diện tối'} aria-pressed={dark}><AudioIcon name={dark ? 'sun' : 'moon'} /></button>
          <button ref={mobileMenuRef} type="button" className="mobile-menu-toggle" aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu điều hướng'} aria-expanded={mobileOpen} aria-controls={menuId} onClick={() => setMobileOpen(value => !value)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d={mobileOpen ? 'M6 6L18 18M18 6L6 18' : 'M4 6H20M4 12H20M4 18H20'} /></svg>
          </button>
        </div>
      </header>
    </>
  );
}
