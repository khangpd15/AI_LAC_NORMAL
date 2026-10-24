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
 * REMICARE AI — ECOKA STYLE UNIFIED NAVIGATION SYSTEM
 *
 * Bao gồm 3 thành phần điều hướng đồng bộ:
 * 1. Top Header: Logo, Brand title, Desktop Nav Items, CTA button, Theme toggle, Hamburger menu.
 * 2. Left Sidebar / Navigation Drawer: Trượt từ cạnh trái khi bấm Hamburger, overlay làm mờ, đóng khi bấm ✕, overlay, Esc hoặc chọn tab.
 * 3. Mobile Bottom Navigation Bar: Ghim cạnh dưới màn hình trên mobile, icon ở trên, nhãn ở dưới, màu cam ECOKA chủ đạo, hỗ trợ safe area.
 */
export default function AppNavbar({
  activeTab = 'home',
  onSelectTab,
  onNavigateHome,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuId = useId();
  const drawerId = useId();
  const hamburgerRef = useRef(null);

  const [dark, setDark] = useState(() => {
    try {
      return (
        (localStorage.getItem('remicare-theme') ||
          (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) ===
        'dark'
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem('remicare-theme', dark ? 'dark' : 'light');
    } catch {
      /* Storage can be unavailable in private mode. */
    }
  }, [dark]);

  // Lock background scroll when drawer is open and handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
        hamburgerRef.current?.focus();
      }
    };

    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawerOpen]);

  const handleBrandClick = () => {
    setDrawerOpen(false);
    if (activeTab === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (onNavigateHome) {
      onNavigateHome();
    } else if (onSelectTab) {
      onSelectTab('home');
    }
  };

  const handleTabClick = (tabKey) => {
    setDrawerOpen(false);
    if (activeTab === tabKey) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (onSelectTab) {
      onSelectTab(tabKey);
    }
  };

  const navItems = [
    {
      key: 'home',
      label: 'Trang chủ',
      shortLabel: 'Trang chủ',
      desc: 'Tổng quan & hướng dẫn sức khỏe mắt',
      icon: <IconNavHome size={22} />,
      title: 'Trang chủ RemiCare',
    },
    {
      key: 'experience',
      label: 'Trải nghiệm',
      shortLabel: 'Trải nghiệm',
      desc: 'Góc nhìn thị giác trẻ nhược thị',
      icon: <IconNavEye size={22} />,
      title: 'Trải nghiệm góc nhìn thị giác',
    },
    {
      key: 'simulation',
      label: 'Mô phỏng lác lé',
      shortLabel: 'Mô phỏng',
      desc: 'AI Webcam mô phỏng mắt trực tiếp',
      icon: <IconNavSimulation size={22} />,
      badge: 'AI Cam',
      title: 'Mô phỏng mắt lác lé bằng AI Webcam trực tiếp',
    },
    {
      key: 'screening',
      label: 'Sàng lọc',
      shortLabel: 'Sàng lọc',
      desc: 'Kiểm tra độ lệch Hirschberg',
      icon: <IconNavCamera size={22} />,
      title: 'Bài kiểm tra sàng lọc thị lực hai mắt',
    },
    {
      key: 'about',
      label: 'Giới thiệu',
      shortLabel: 'Giới thiệu',
      desc: 'Sứ mệnh & công nghệ cộng đồng',
      icon: <IconNavAbout size={22} />,
      title: 'Giới thiệu sứ mệnh và công nghệ RemiCare',
    },
  ];

  return (
    <>
      <SvgGradients />

      {/* ====================================================================
          1. TOP NAVIGATION HEADER
          ==================================================================== */}
      <header
        className="remicare-unified-navbar ecoka-navbar"
        data-mobile-open={drawerOpen}
        role="banner"
        aria-label="Thanh điều hướng chính RemiCare AI"
      >
        <div className="unified-navbar-inner">
          {/* Brand Logo & Title */}
          <div
            className="unified-navbar-brand"
            onClick={handleBrandClick}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleBrandClick();
              }
            }}
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
              <span className="unified-brand-subtitle">AI CHĂM SÓC MẮT</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav id={menuId} className="unified-navbar-nav" aria-label="Các trang chính">
            <ul className="unified-navbar-items">
              {navItems.map((item) => {
                const isActive = activeTab === item.key;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      aria-current={isActive ? 'page' : undefined}
                      className={`unified-nav-btn ${isActive ? 'active' : ''}`}
                      onClick={() => handleTabClick(item.key)}
                      title={item.title}
                    >
                      <span className="unified-nav-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                      {item.badge && <span className="unified-nav-badge-new">{item.badge}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Right Header Actions */}
          <div className="unified-navbar-actions">
            <button
              type="button"
              className="navbar-quick-cta"
              onClick={() => handleTabClick('screening')}
              title="Bắt đầu sàng lọc mắt ngay"
            >
              <span>Sàng lọc ngay</span>
              <span className="cta-arrow" aria-hidden="true">→</span>
            </button>

            <button
              type="button"
              className="care-theme-toggle"
              onClick={() => setDark((value) => !value)}
              aria-label={dark ? 'Bật giao diện sáng' : 'Bật giao diện tối'}
              aria-pressed={dark}
              title={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            >
              <AudioIcon name={dark ? 'sun' : 'moon'} />
            </button>

            <button
              ref={hamburgerRef}
              type="button"
              className="navbar-hamburger-btn mobile-menu-toggle"
              aria-label={drawerOpen ? 'Đóng menu' : 'Mở menu điều hướng'}
              aria-expanded={drawerOpen}
              aria-controls={drawerId}
              onClick={() => setDrawerOpen((value) => !value)}
            >
              <span className="hamburger-box">
                <span className={`hamburger-inner ${drawerOpen ? 'is-active' : ''}`} />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ====================================================================
          2. SIDEBAR / NAVIGATION DRAWER (SLIDE-IN FROM LEFT)
          ==================================================================== */}
      {/* Backdrop overlay */}
      <div
        className={`remicare-drawer-overlay ${drawerOpen ? 'is-open' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer content panel */}
      <aside
        id={drawerId}
        className={`remicare-sidebar-drawer ${drawerOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu điều hướng RemiCare"
      >
        <div className="drawer-header">
          <div className="drawer-brand" onClick={handleBrandClick} role="button" tabIndex={0}>
            <img
              src="/images/logo.jpg"
              alt="Logo RemiCare AI"
              className="drawer-logo-img"
            />
            <div className="drawer-brand-text">
              <span className="drawer-brand-title">RemiCare AI</span>
              <span className="drawer-brand-sub">Sức khỏe thị giác cộng đồng</span>
            </div>
          </div>

          <button
            type="button"
            className="drawer-close-btn"
            onClick={() => {
              setDrawerOpen(false);
              hamburgerRef.current?.focus();
            }}
            aria-label="Đóng menu điều hướng"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-section-label">ĐIỀU HƯỚNG CHÍNH</div>
          <ul className="drawer-nav-list">
            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    className={`drawer-nav-item ${isActive ? 'is-active' : ''}`}
                    onClick={() => handleTabClick(item.key)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <div className="drawer-item-icon-box">
                      {item.icon}
                    </div>
                    <div className="drawer-item-info">
                      <div className="drawer-item-title-row">
                        <strong className="drawer-item-title">{item.label}</strong>
                        {item.badge && <span className="drawer-item-badge">{item.badge}</span>}
                      </div>
                      <small className="drawer-item-desc">{item.desc}</small>
                    </div>
                    <span className="drawer-item-arrow" aria-hidden="true">›</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="drawer-card-box">
            <div className="drawer-card-badge">✨ TRỢ LÝ GIỌNG NÓI</div>
            <h4>Bé Iris đồng hành</h4>
            <p>Bật loa trên mọi trang để nghe Iris hướng dẫn từng bước kiểm tra và chăm sóc mắt thật nhẹ nhàng.</p>
          </div>
        </div>

        <div className="drawer-footer">
          <button
            type="button"
            className="drawer-cta-btn"
            onClick={() => handleTabClick('screening')}
          >
            🔍 Bắt đầu sàng lọc ngay
          </button>

          <div className="drawer-footer-meta">
            <a
              href="tel:0916973161"
              className="drawer-footer-version"
              title="Gọi 0916973161 - Phùng Đình Khang"
            >
              0916973161 - Phùng Đình Khang
            </a>
            <button
              type="button"
              className="drawer-theme-btn"
              onClick={() => setDark((v) => !v)}
              aria-label={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            >
              <span>{dark ? '☀️ Giao diện sáng' : '🌙 Giao diện tối'}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ====================================================================
          3. MOBILE BOTTOM NAVIGATION BAR (FIXED BOTTOM)
          ==================================================================== */}
      <nav className="remicare-bottom-nav" aria-label="Thanh điều hướng dưới mobile">
        <div className="bottom-nav-inner">
          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleTabClick(item.key)}
                aria-current={isActive ? 'page' : undefined}
                title={item.title}
              >
                <div className="bottom-nav-icon-wrap" aria-hidden="true">
                  {item.icon}
                </div>
                <span className="bottom-nav-label">{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
