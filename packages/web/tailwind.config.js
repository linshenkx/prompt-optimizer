/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
    "../../node_modules/@prompt-optimizer/ui/src/**/*.{vue,js,ts,jsx,tsx}"
  ],
  // Use class-based dark mode so the app can control theme via `.dark`.
  // The `.dark` class is synced from Naive UI theme selection.
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ],
}
