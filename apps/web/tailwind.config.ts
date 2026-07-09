import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Islamic-professional palette: emerald primary, gold secondary
        emerald: {
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
          400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857',
          800: '#065f46', 900: '#064e3b', 950: '#022c22',
        },
        gold: {
          50: '#fbf7ed', 100: '#f5eccf', 200: '#ecd79c', 300: '#e2bd63',
          400: '#daa53c', 500: '#c98a28', 600: '#ab6b20', 700: '#894e1f',
          800: '#713f20', 900: '#60351e', 950: '#371b0d',
        },
      },
    },
  },
  plugins: [],
};

export default config;
