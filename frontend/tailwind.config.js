/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1B2A3B',
          light: '#243447',
        },
        teal: {
          DEFAULT: '#0F7B6C',
          light: '#E6F4F1',
        },
        clinical: {
          bg: '#F0F2F5',
          surface: '#FFFFFF',
          'surface-2': '#F8F9FA',
          border: '#DEE2E6',
          'border-strong': '#ADB5BD',
          text: '#212529',
          'text-2': '#495057',
          'text-3': '#6C757D',
          critical: '#B02A37',
          'critical-bg': '#FFF0F0',
          'critical-border': '#F5C2C7',
          warning: '#856404',
          'warning-bg': '#FFF8E1',
          'warning-border': '#FFECB5',
          info: '#0A58CA',
          'info-bg': '#EFF6FF',
          success: '#146C43',
          'success-bg': '#D1E7DD',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
      fontSize: {
        '2xs': '10px',
        xs: '11px',
        sm: '12px',
        base: '13px',
        md: '14px',
        lg: '15px',
        xl: '16px',
        '2xl': '18px',
      },
      borderRadius: {
        none: '0',
        sm: '2px',
        DEFAULT: '3px',
        md: '4px',
        lg: '4px',
        full: '9999px',
      },
      width: {
        sidebar: '240px',
      },
    },
  },
  plugins: [],
};
