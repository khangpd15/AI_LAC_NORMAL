import React, { useState, useEffect } from 'react';
import HomePage from './components/home/HomePage';
import BinocularVisionScreening from './components/binocular/BinocularVisionScreening';
import ExperienceVisionPage from './components/ExperienceVision/ExperienceVisionPage';
import StrabismusSimulationPage from './components/StrabismusSimulation/StrabismusSimulationPage';
import AboutPage from './components/about/AboutPage';
import AppNavbar from './components/common/AppNavbar';
import AppFooter from './components/common/AppFooter';
import ErrorBoundary from './components/ErrorBoundary';
import { ListeningProvider } from './components/audio/ListeningExperience';
import './redesign.css';
import './sitePhotos.css';

export default function App() {
  // Navigation views: 'home' (Trang chủ) | 'experience' (Trải nghiệm góc nhìn) | 'simulation' (Mô phỏng lác lé) | 'screening' (Sàng lọc hai mắt) | 'about' (Giới thiệu)
  const [activeTab, setActiveTab] = useState('home');

  return <ListeningProvider key={activeTab}><AppContent activeTab={activeTab} setActiveTab={setActiveTab} /></ListeningProvider>;
}

function AppContent({ activeTab, setActiveTab }) {

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // 1. Home / Landing Page Mode (Default)
  if (activeTab === 'home') {
    return (
      <ErrorBoundary>
        <HomePage
          onStartExperience={() => setActiveTab('experience')}
          onStartScreening={() => setActiveTab('screening')}
          onStartSimulation={() => setActiveTab('simulation')}
          onOpenAbout={() => setActiveTab('about')}
        />
      </ErrorBoundary>
    );
  }

  // 2. Experience Vision Mode (Fullscreen Camera Realtime)
  if (activeTab === 'experience') {
    return (
      <ErrorBoundary>
        <ExperienceVisionPage
          onStartScreening={() => setActiveTab('screening')}
          onExit={() => setActiveTab('home')}
        />
      </ErrorBoundary>
    );
  }

  // 3. Strabismus Eye Simulation Mode (Realtime Webcam AI Warping)
  if (activeTab === 'simulation') {
    return (
      <ErrorBoundary>
        <StrabismusSimulationPage
          onExit={() => setActiveTab('home')}
          onStartScreening={() => setActiveTab('screening')}
        />
      </ErrorBoundary>
    );
  }

  // 4. About RemiCare AI Page
  if (activeTab === 'about') {
    return (
      <ErrorBoundary>
        <AboutPage
          onNavigateHome={() => setActiveTab('home')}
          onStartExperience={() => setActiveTab('experience')}
          onStartScreening={() => setActiveTab('screening')}
          onStartSimulation={() => setActiveTab('simulation')}
        />
      </ErrorBoundary>
    );
  }

  // 5. Binocular Vision Screening Mode (Clinical screening protocol)
  return (
    <div className="app-layout">
      {/* Unified Master Application Navbar */}
      <AppNavbar
        activeTab="screening"
        onSelectTab={setActiveTab}
        onNavigateHome={() => setActiveTab('home')}
      />

      {/* Main Content Area */}
      <main className="app-main" id="main-content">
        <ErrorBoundary>
          <BinocularVisionScreening />
        </ErrorBoundary>
      </main>

      {/* Master Comprehensive App Footer */}
      <AppFooter
        onNavigateHome={() => setActiveTab('home')}
        onStartExperience={() => setActiveTab('experience')}
        onStartScreening={() => setActiveTab('screening')}
        onStartSimulation={() => setActiveTab('simulation')}
        onOpenAbout={() => setActiveTab('about')}
      />
    </div>
  );
}


