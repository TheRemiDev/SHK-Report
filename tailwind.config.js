/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/views/**/*.ejs', './src/public/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0A0A0C',
          50: '#F5F6F7',
          100: '#E7E8EB',
          200: '#C7C9CF',
          300: '#9A9DA8',
          400: '#6B6F7C',
          500: '#4A4E5A',
          600: '#33363F',
          700: '#232529',
          800: '#17181B',
          900: '#0A0A0C',
        },
        teal: {
          50: '#EDFBF8',
          100: '#D2F5EE',
          200: '#A6EBDD',
          300: '#70DCC8',
          400: '#3BC7AC',
          500: '#0F9E8F',
          600: '#0C8177',
          700: '#0C665F',
          800: '#0E524D',
          900: '#0F4440',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(10,10,12,0.04), 0 1px 6px -1px rgba(10,10,12,0.06)',
        pop: '0 10px 30px -10px rgba(10,10,12,0.25)',
      },
    },
  },
  plugins: [],
};
