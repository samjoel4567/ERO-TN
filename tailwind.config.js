/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Workspace Warm Ivory / Off-White palette
        ivory: {
          50: '#FDFCF9',
          100: '#FBF9F5',
          200: '#F5F1E8',
          300: '#EAE4D6',
          400: '#DBD3C1',
          border: '#E2DCD0',
          borderDark: '#D4CDC0'
        },
        // Sidebar & Dark Operational Panels Graphite/Charcoal palette
        graphite: {
          950: '#101214',
          900: '#171A1D',
          850: '#1E2226',
          800: '#252A2F',
          750: '#2C3339',
          700: '#353D44',
          border: '#2B3137',
          borderSubtle: '#22272C'
        },
        // Burnt Orange - Primary actions & important highlights
        burnt: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          400: '#FB923C',
          500: '#F97316',
          600: '#D9531E',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12'
        },
        // Teal - Available resources & successful operations
        tealops: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59'
        },
        // Red - Critical emergencies
        critical: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B'
        },
        // Amber - Warnings & delays
        caution: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309'
        },
        // Green - Safe / operational status
        operational: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
