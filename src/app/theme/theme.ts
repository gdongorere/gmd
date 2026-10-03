// src/app/theme/theme.ts
// Design tokens for the whole site. The site is dark-only: it sits on top of the
// Milky Way background, so every token is a single value (no light/dark pairs).
//
// Contrast notes (WCAG 2.2 AA, 4.5:1 for body text):
//   content.primary   #FFFFFF  on surface.glass  ~17:1
//   content.secondary #C4C4C4  on surface.glass  ~10:1
//   content.muted     #9A9A9A  on surface.glass  ~6.3:1
//   accent.fg         #FF7A45  on surface.glass  ~7:1   (use for orange text and links)
//   white on accent.solid #C93400                ~5.3:1  (use for filled buttons)

import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const orange = {
  50: '#FFF2EC',
  100: '#FFD6C2',
  200: '#FFB999',
  300: '#FF9C70',
  400: '#FF7F47',
  500: '#FF3F00',
  600: '#E04600',
  700: '#C23D00',
  800: '#A33400',
  900: '#852B00',
};

const colors = {
  brand: orange,
  accent: orange,
  gray: {
    50: '#F5F5F5',
    100: '#E5E5E5',
    200: '#CFCFCF',
    300: '#B3B3B3',
    400: '#8F8F8F',
    500: '#6B6B6B',
    600: '#474747',
    700: '#2E2E2E',
    800: '#1C1C1C',
    900: '#0F0F0F',
  },
};

const semanticTokens = {
  colors: {
    // Surfaces
    'surface.canvas': '#0A0A0A',
    'surface.glass': 'rgba(18, 18, 18, 0.72)',
    'surface.glassStrong': 'rgba(14, 14, 14, 0.9)',
    'surface.raised': 'rgba(34, 34, 34, 0.92)',
    'surface.inset': 'rgba(255, 255, 255, 0.05)',
    // Text
    'content.primary': '#FFFFFF',
    'content.secondary': '#C4C4C4',
    'content.muted': '#9A9A9A',
    // Lines
    'line.subtle': 'rgba(255, 255, 255, 0.12)',
    'line.strong': 'rgba(255, 255, 255, 0.28)',
    // Accent
    'accent.fg': '#FF7A45',
    'accent.solid': '#C93400',
    'accent.solidHover': '#AD2D00',
    'accent.subtle': 'rgba(255, 63, 0, 0.14)',
    // Focus
    'focus.ring': '#FFA173',
  },
};

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

const styles = {
  global: {
    'html, body': {
      minHeight: '100%',
      bg: 'surface.canvas',
      color: 'content.primary',
    },
    body: {
      position: 'relative',
      overflowX: 'hidden',
    },
    canvas: { display: 'block' },
    '::selection': { bg: 'rgba(255, 63, 0, 0.35)', color: 'white' },
    // One visible focus style for everything keyboard-reachable.
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'focus.ring',
      outlineOffset: '2px',
    },
    ':focus:not(:focus-visible)': { outline: 'none' },
  },
};

const fontStack = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const components = {
  Heading: {
    baseStyle: { color: 'content.primary', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 },
    // Fluid type scale: smooth between phone and desktop.
    sizes: {
      '4xl': { fontSize: 'clamp(2.75rem, 7.5vw, 5.5rem)', lineHeight: 1.02 },
      '3xl': { fontSize: 'clamp(2.25rem, 5.5vw, 4rem)', lineHeight: 1.05 },
      '2xl': { fontSize: 'clamp(1.9rem, 4vw, 3rem)', lineHeight: 1.1 },
      xl: { fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', lineHeight: 1.15 },
      lg: { fontSize: 'clamp(1.25rem, 2.2vw, 1.625rem)', lineHeight: 1.2 },
      md: { fontSize: 'clamp(1.1rem, 1.6vw, 1.25rem)', lineHeight: 1.25 },
    },
  },
  Text: { baseStyle: { color: 'content.primary' } },
  Link: {
    baseStyle: {
      color: 'accent.fg',
      textUnderlineOffset: '3px',
      _hover: { color: 'white', textDecoration: 'underline' },
    },
  },
  Button: {
    baseStyle: {
      fontWeight: 600,
      borderRadius: 'xl',
      transitionProperty: 'background-color, border-color, color, transform, box-shadow',
      transitionDuration: '160ms',
    },
    variants: {
      solid: {
        bg: 'accent.solid',
        color: 'white',
        _hover: { bg: 'accent.solidHover', _disabled: { bg: 'accent.solid' } },
        _active: { bg: 'accent.solidHover', transform: 'translateY(1px)' },
      },
      outline: {
        bg: 'transparent',
        color: 'content.primary',
        border: '1px solid',
        borderColor: 'line.strong',
        _hover: { bg: 'surface.inset', borderColor: 'accent.fg', color: 'white' },
        _active: { bg: 'surface.inset' },
      },
      ghost: {
        color: 'content.secondary',
        _hover: { bg: 'surface.inset', color: 'white' },
        _active: { bg: 'surface.inset' },
      },
      glass: {
        bg: 'surface.glass',
        color: 'content.primary',
        border: '1px solid',
        borderColor: 'line.subtle',
        backdropFilter: 'blur(12px) saturate(160%)',
        _hover: { borderColor: 'accent.fg', color: 'accent.fg' },
      },
    },
    defaultProps: { variant: 'solid' },
  },
  Input: {
    variants: {
      outline: {
        field: {
          bg: 'surface.glassStrong',
          color: 'content.primary',
          borderColor: 'line.strong',
          _placeholder: { color: 'content.muted' },
          _hover: { borderColor: 'whiteAlpha.600' },
          _focusVisible: { borderColor: 'focus.ring', boxShadow: '0 0 0 1px var(--chakra-colors-focus-ring)', outline: 'none' },
          _invalid: { borderColor: 'red.300', boxShadow: '0 0 0 1px var(--chakra-colors-red-300)' },
        },
      },
    },
  },
  Textarea: {
    variants: {
      outline: {
        bg: 'surface.glassStrong',
        color: 'content.primary',
        borderColor: 'line.strong',
        _placeholder: { color: 'content.muted' },
        _hover: { borderColor: 'whiteAlpha.600' },
        _focusVisible: { borderColor: 'focus.ring', boxShadow: '0 0 0 1px var(--chakra-colors-focus-ring)', outline: 'none' },
        _invalid: { borderColor: 'red.300', boxShadow: '0 0 0 1px var(--chakra-colors-red-300)' },
      },
    },
  },
  Select: {
    variants: {
      outline: {
        field: {
          bg: 'surface.glassStrong',
          color: 'content.primary',
          borderColor: 'line.strong',
          _focusVisible: { borderColor: 'focus.ring', boxShadow: '0 0 0 1px var(--chakra-colors-focus-ring)', outline: 'none' },
        },
      },
    },
  },
  FormLabel: { baseStyle: { color: 'content.secondary', fontWeight: 500, fontSize: 'sm' } },
  FormError: { baseStyle: { text: { color: 'red.300' } } },
  Modal: {
    baseStyle: {
      overlay: { bg: 'blackAlpha.700', backdropFilter: 'blur(6px)' },
      dialog: {
        bg: 'surface.glassStrong',
        color: 'content.primary',
        border: '1px solid',
        borderColor: 'line.subtle',
        backdropFilter: 'blur(16px) saturate(160%)',
      },
    },
  },
  Drawer: {
    baseStyle: {
      overlay: { bg: 'blackAlpha.700', backdropFilter: 'blur(6px)' },
      dialog: {
        bg: 'surface.glassStrong',
        color: 'content.primary',
        borderLeft: '1px solid',
        borderColor: 'line.subtle',
        backdropFilter: 'blur(16px) saturate(160%)',
      },
    },
  },
  Tag: {
    baseStyle: { container: { borderRadius: 'md', fontWeight: 500 } },
    variants: {
      subtle: { container: { bg: 'surface.inset', color: 'content.secondary', border: '1px solid', borderColor: 'line.subtle' } },
      accent: { container: { bg: 'accent.subtle', color: 'accent.fg' } },
    },
    defaultProps: { variant: 'subtle' },
  },
  Tooltip: {
    baseStyle: { bg: 'surface.raised', color: 'content.primary', borderRadius: 'md', px: 3, py: 2, fontSize: 'sm' },
  },
  Divider: { baseStyle: { borderColor: 'line.subtle' } },
};

const theme = extendTheme({
  config,
  colors,
  semanticTokens,
  styles,
  components,
  radii: { md: '10px', lg: '12px', xl: '16px', '2xl': '24px' },
  shadows: {
    sm: '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)',
    md: '0 4px 12px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.4)',
    lg: '0 12px 28px rgba(0,0,0,0.65), 0 4px 8px rgba(0,0,0,0.45)',
    xl: '0 24px 48px rgba(0,0,0,0.75), 0 10px 16px rgba(0,0,0,0.5)',
  },
  fonts: {
    heading: `var(--font-display), var(--font-body), ${fontStack}`,
    body: `var(--font-body), ${fontStack}`,
  },
});

export default theme;
