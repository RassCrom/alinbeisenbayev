// Tailwind CSS v4 is configured via CSS (@import "tailwindcss" in global.css).
// This file exists for tooling compatibility; design tokens live in src/styles/tokens.css.
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
} satisfies Config;
