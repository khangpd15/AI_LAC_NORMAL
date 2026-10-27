/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  corePlugins: {
    // Tắt hoàn toàn preflight để không reset CSS/heading/buttons của Repo A
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        remi: {
          // Primary Colors
          mint: '#00AB9B',       // Mint (Brand Primary)
          teal: '#00545D',       // Deep Teal (Primary Dark / Text)
          warmWhite: '#F9F8F2',  // Warm White (Main Background)

          // Secondary Colors
          softMint: '#B8E8DF',   // Soft Mint (Border / Secondary UI)
          paleTeal: '#E1F4F0',   // Pale Teal (Card / Section Surface)
          deepGreen: '#267A78',  // Deep Green (Interactive Hover / Muted Text)

          // Accent Colors
          coral: '#F28C7B',      // Warm Coral (Highlight / Alert CTA)
          amber: '#F2C66D',      // Soft Amber (Badge / Warning / Accent)

          // Dark Theme Harmonized Palette (Medical Deep Teal Dark Mode)
          darkBg: '#0F172A',     // Main Dark Background (đồng bộ với A: #0F172A)
          darkCard: '#1E293B',   // Card Surface in Dark Mode (đồng bộ với A: #1E293B)
          darkCardHover: '#293548', // Hover Surface in Dark Mode (đồng bộ với A: #293548)
          darkBorder: '#1E4650', // Borders in Dark Mode (đồng bộ với A: #1E4650)
          darkMuted: '#94A3B8',  // Muted Subtext in Dark Mode (đồng bộ với A: #94A3B8)
        },
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'remi-card': '0 4px 20px -2px rgba(0, 84, 93, 0.06), 0 2px 6px -1px rgba(0, 84, 93, 0.04)',
        'remi-card-dark': '0 4px 20px -2px rgba(0, 0, 0, 0.4), 0 2px 6px -1px rgba(0, 0, 0, 0.25)',
        'remi-button': '0 4px 14px 0 rgba(0, 171, 155, 0.35)',
        'remi-hover': '0 6px 20px 0 rgba(0, 84, 93, 0.12)',
      },
    },
  },
  plugins: [],
}
