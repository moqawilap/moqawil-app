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
    background: '#F6F8FB',
    foreground: '#102E4A',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#102E4A',

    // Primary action color (buttons, links, active states)
    primary: '#0F6FB7',
    primaryForeground: '#FFFFFF',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E8F4FA',
    secondaryForeground: '#102E4A',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#EDF1F5',
    mutedForeground: '#708196',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#D9F8F2',
    accentForeground: '#0B6E6B',

    // Destructive actions (delete, error states)
    destructive: '#D95C5C',
    destructiveForeground: '#FFFFFF',

    // Borders and input outlines
    border: '#DCE5ED',
    input: '#DCE5ED',

    // Product-specific tokens
    navy: '#08284A',
    surface: '#FFFFFF',
    surfaceMuted: '#EAF0F5',
    primarySoft: '#E2F2FA',
    star: '#F5AA45',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 16,
};

export default colors;
