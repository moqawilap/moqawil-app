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
    background: '#F6F4EF',
    foreground: '#102B43',

    // Cards / elevated surfaces
    card: '#FFFDFC',
    cardForeground: '#102B43',

    // Primary action color (buttons, links, active states)
    primary: '#174A67',
    primaryForeground: '#FFFFFF',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E8EEF0',
    secondaryForeground: '#12364E',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#EEEDE8',
    mutedForeground: '#70808B',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#F4E7C8',
    accentForeground: '#A97832',

    // Destructive actions (delete, error states)
    destructive: '#D95C5C',
    destructiveForeground: '#FFFFFF',

    // Borders and input outlines
    border: '#DCE1DF',
    input: '#DCE1DF',

    // Product-specific tokens
    navy: '#092A45',
    surface: '#FFFDFC',
    surfaceMuted: '#EFF1EE',
    primarySoft: '#E3EDF1',
    star: '#F5AA45',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 16,
};

export default colors;
