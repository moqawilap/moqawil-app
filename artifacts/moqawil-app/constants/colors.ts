/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#102E4A',
    tint: '#0F6FB7',

    // Core surfaces
    background: '#F3F7F9',
    foreground: '#102E4A',

    // Cards / elevated surfaces
    card: '#FEFFFF',
    cardForeground: '#102E4A',

    // Primary action color (buttons, links, active states)
    primary: '#0F6FB7',
    primaryForeground: '#FFFFFF',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E4F1F6',
    secondaryForeground: '#102E4A',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#E8EFF3',
    mutedForeground: '#6C7F91',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#D7F5EF',
    accentForeground: '#0B6E6B',

    // Destructive actions (delete, error states)
    destructive: '#D95C5C',
    destructiveForeground: '#FFFFFF',

    // Borders and input outlines
    border: '#D7E3EA',
    input: '#D7E3EA',

    // Product-specific tokens
    navy: '#08284A',
    surface: '#FEFFFF',
    surfaceMuted: '#E8F0F4',
    primarySoft: '#DFF1F8',
    star: '#F5AA45',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 16,
};

export default colors;
