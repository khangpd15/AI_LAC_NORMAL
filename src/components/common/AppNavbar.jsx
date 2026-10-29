import React, { useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
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
 * REMICARE AI — UNIFIED NAVIGATION SYSTEM
 *
 * Bao gồm:
 * 1. Top Header: Logo, Desktop Nav Items với Dropdown "Sàng lọc" 2 cấp (Lác/Lé vs Sụp Mí), CTA "Sàng lọc ngay", Theme toggle, Hamburger menu.
 * 2. Left Sidebar / Navigation Drawer: Trượt từ cạnh trái, Accordion "Sàng lọc", đóng khi bấm Esc/overlay.
 * 3. Mobile Bottom Navigation Bar: Ghim cạnh dưới màn hình mobile.
 */
export default function AppNavbar({
  activeTab: propActiveTab,
  onSelectTab,
  onNavigateHome,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [drawerScreeningOpen, setDrawerScreeningOpen] = useState(true);

  const menuId = useId();
  const drawerId = useId();
  const dropdownMenuId = useId();
  const hamburgerRef = useRef(null);
  const dropdownRef = useRef(null);
  const dropdownTriggerRef = useRef(null);
  const dropdownItemsRef = useRef([]);
  const hoverTimeoutRef = useRef(null);

  // Router hooks (fallback an toàn nếu không nằm trong Router)
  const location = useLocation();
  const navigate = useNavigate();

  // Xác định active tab từ pathname
  const currentPath = location?.pathname || '';
  let activeTab = propActiveTab || 'home';
  if (currentPath === '/') activeTab = 'home';
  else if (currentPath === '/trai-nghiem') activeTab = 'experience';
  else if (currentPath === '/mo-phong') activeTab = 'simulation';
  else if (currentPath.startsWith('/sang-loc')) activeTab = 'screening';
  else if (currentPath === '/gioi-thieu') activeTab = 'about';

  // Theme State
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

  // Đóng dropdown và drawer khi đổi route
  useEffect(() => {
    setDropdownOpen(false);
    setDrawerOpen(false);
  }, [currentPath]);

  // Click outside listener cho dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  // Lock background scroll when drawer is open and handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (dropdownOpen) {
          setDropdownOpen(false);
          dropdownTriggerRef.current?.focus();
        } else if (drawerOpen) {
          setDrawerOpen(false);
          hamburgerRef.current?.focus();
        }
      }
    };

    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawerOpen, dropdownOpen]);

  // Hover delay chống giật cho Dropdown trên Desktop
  const handleDropdownMouseEnter = () => {
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setDropdownOpen(true);
    }, 120);
  };

  const handleDropdownMouseLeave = () => {
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setDropdownOpen(false);
    }, 180);
  };

  const handleBrandClick = () => {
    setDrawerOpen(false);
    setDropdownOpen(false);
    if (navigate) {
      navigate('/');
    } else if (onNavigateHome) {
      onNavigateHome();
    } else if (onSelectTab) {
      onSelectTab('home');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabClick = (tabKey, path) => {
    setDrawerOpen(false);
    setDropdownOpen(false);
    if (path && navigate) {
      navigate(path);
    } else if (onSelectTab) {
      onSelectTab(tabKey);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Keyboard navigation for dropdown menu items
  const handleTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setDropdownOpen(true);
      setTimeout(() => {
        dropdownItemsRef.current[0]?.focus();
      }, 50);
    }
  };

  const handleItemKeyDown = (e, index) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (index + 1) % screeningSubItems.length;
      dropdownItemsRef.current[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (index - 1 + screeningSubItems.length) % screeningSubItems.length;
      dropdownItemsRef.current[prevIndex]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      dropdownItemsRef.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      dropdownItemsRef.current[screeningSubItems.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDropdownOpen(false);
      dropdownTriggerRef.current?.focus();
    }
  };

  const screeningSubItems = [
    {
      key: 'strabismus',
      path: '/sang-loc/lac-le',
      label: 'Sàng lọc lác / lé',
      desc: 'Hirschberg & Digital Cover Test',
      icon: <IconNavCamera size={18} />,
    },
    {
      key: 'ptosis',
      path: '/sang-loc/sup-mi',
      label: 'Sàng lọc sụp mí',
      desc: 'Hình thái học khe mi & MRD-1',
      icon: <IconNavEye size={18} />,
    },
  ];

  const navItems = [
    {
      key: 'home',
      path: '/',
      label: 'Trang chủ',
      shortLabel: 'Trang chủ',
      desc: 'Tổng quan & hướng dẫn sức khỏe mắt',
      icon: <IconNavHome size={22} />,
      title: 'Trang chủ RemiCare',
    },
    {
      key: 'experience',
      path: '/trai-nghiem',
      label: 'Trải nghiệm',
      shortLabel: 'Trải nghiệm',
      desc: 'Góc nhìn thị giác trẻ nhược thị',
      icon: <IconNavEye size={22} />,
      title: 'Trải nghiệm góc nhìn thị giác',
    },
    {
      key: 'simulation',
      path: '/mo-phong',
      label: 'Mô phỏng lác lé',
      shortLabel: 'Mô phỏng',
      desc: 'AI Webcam mô phỏng mắt trực tiếp',
      icon: <IconNavSimulation size={22} />,
      badge: 'AI Cam',
      title: 'Mô phỏng mắt lác lé bằng AI Webcam trực tiếp',
    },
    {
      key: 'screening',
      path: '/sang-loc',
      label: 'Sàng lọc',
      shortLabel: 'Sàng lọc',
      desc: 'Kiểm tra thị lực hai mắt & sụp mí',
      icon: <IconNavCamera size={22} />,
      title: 'Bài kiểm tra sàng lọc thị lực bằng AI',
      isDropdown: true,
    },
    {
      key: 'about',
      path: '/gioi-thieu',
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

                // Xử lý nút Dropdown Sàng lọc
                if (item.isDropdown) {
                  return (
                    <li
                      key={item.key}
                      className="unified-nav-dropdown-wrapper"
                      ref={dropdownRef}
                      onMouseEnter={handleDropdownMouseEnter}
                      onMouseLeave={handleDropdownMouseLeave}
                    >
                      <button
                        ref={dropdownTriggerRef}
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        aria-haspopup="menu"
                        aria-expanded={dropdownOpen}
                        aria-controls={dropdownMenuId}
                        className={`unified-nav-btn has-dropdown ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          setDropdownOpen((prev) => !prev);
                        }}
                        onKeyDown={handleTriggerKeyDown}
                        title={item.title}
                      >
                        <span className="unified-nav-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                        {/* Icon chevron xoay khi mở */}
                        <svg
                          className={`dropdown-chevron-icon ${dropdownOpen ? 'is-open' : ''}`}
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {/* Dropdown Menu Panel */}
                      {dropdownOpen && (
                        <div
                          id={dropdownMenuId}
                          role="menu"
                          aria-label="Danh mục sàng lọc mắt"
                          className="unified-dropdown-menu"
                        >
                          <div className="dropdown-menu-items">
                            {screeningSubItems.map((subItem, idx) => {
                              const isSubActive = currentPath === subItem.path;
                              return (
                                <Link
                                  key={subItem.key}
                                  ref={(el) => (dropdownItemsRef.current[idx] = el)}
                                  to={subItem.path}
                                  role="menuitem"
                                  className={`dropdown-menu-item ${isSubActive ? 'is-active' : ''}`}
                                  onClick={() => setDropdownOpen(false)}
                                  onKeyDown={(e) => handleItemKeyDown(e, idx)}
                                >
                                  <div className="dropdown-item-icon-box" aria-hidden="true">
                                    {subItem.icon}
                                  </div>
                                  <div className="dropdown-item-text">
                                    <span className="dropdown-item-label">{subItem.label}</span>
                                    <span className="dropdown-item-desc">{subItem.desc}</span>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                }

                // Các link thông thường khác
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      aria-current={isActive ? 'page' : undefined}
                      className={`unified-nav-btn ${isActive ? 'active' : ''}`}
                      onClick={() => handleTabClick(item.key, item.path)}
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
            {/* CTA Button: Mặc định dẫn tới Hub /sang-loc theo Lựa chọn 4.3 */}
            <Link
              to="/sang-loc"
              className="navbar-quick-cta"
              title="Bắt đầu sàng lọc mắt ngay"
            >
              <span>Sàng lọc ngay</span>
              <span className="cta-arrow" aria-hidden="true">→</span>
            </Link>

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

              // Accordion trong Drawer cho Sàng lọc
              if (item.isDropdown) {
                return (
                  <li key={item.key} className="drawer-nav-accordion-item">
                    <button
                      type="button"
                      className={`drawer-nav-item has-accordion ${isActive ? 'is-active' : ''}`}
                      onClick={() => setDrawerScreeningOpen((prev) => !prev)}
                      aria-expanded={drawerScreeningOpen}
                    >
                      <div className="drawer-item-icon-box">
                        {item.icon}
                      </div>
                      <div className="drawer-item-info">
                        <div className="drawer-item-title-row">
                          <strong className="drawer-item-title">{item.label}</strong>
                          <span className="drawer-item-badge">2 phương pháp</span>
                        </div>
                        <small className="drawer-item-desc">{item.desc}</small>
                      </div>
                      <span className={`drawer-item-accordion-icon ${drawerScreeningOpen ? 'open' : ''}`}>
                        ›
                      </span>
                    </button>

                    {/* Accordion Sub-list */}
                    {drawerScreeningOpen && (
                      <div className="drawer-sub-list">
                        {screeningSubItems.map((sub) => {
                          const isSubActive = currentPath === sub.path;
                          return (
                            <Link
                              key={sub.key}
                              to={sub.path}
                              className={`drawer-sub-item ${isSubActive ? 'active' : ''}`}
                              onClick={() => setDrawerOpen(false)}
                            >
                              <span className="sub-item-icon">{sub.icon}</span>
                              <div className="sub-item-text">
                                <span className="sub-item-title">{sub.label}</span>
                                <span className="sub-item-desc">{sub.desc}</span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              }

              return (
                <li key={item.key}>
                  <button
                    type="button"
                    className={`drawer-nav-item ${isActive ? 'is-active' : ''}`}
                    onClick={() => handleTabClick(item.key, item.path)}
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
            <div className="drawer-card-badge">TRỢ LÝ GIỌNG NÓI</div>
            <h4>Bé Lumi đồng hành</h4>
            <p>Bật loa trên mọi trang để nghe Lumi hướng dẫn từng bước kiểm tra và chăm sóc mắt thật nhẹ nhàng.</p>
          </div>
        </div>

        <div className="drawer-footer">
          <Link
            to="/sang-loc"
            className="drawer-cta-btn"
            onClick={() => setDrawerOpen(false)}
          >
            🔍 Bắt đầu sàng lọc ngay
          </Link>

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
                onClick={() => handleTabClick(item.key, item.path)}
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
