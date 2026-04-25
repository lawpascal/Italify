// App-wide design tokens
import { useColorScheme } from "react-native";

export const LIGHT_COLORS = {
  bg: "#F8F9FA",
  surface: "#FFFFFF",
  primary: "#E63946",
  primaryDark: "#B91C1C",
  secondary: "#FFD166",
  secondaryDark: "#FFB703",
  success: "#06D6A0",
  successDark: "#04A77D",
  error: "#EF476F",
  info: "#118AB2",
  text: "#2B2D42",
  textMuted: "#6C757D",
  textDisabled: "#ADB5BD",
  border: "#DEE2E6",
  borderLight: "#E9ECEF",
};

export const DARK_COLORS = {
  bg: "#1A1B2E",
  surface: "#252640",
  primary: "#E63946",
  primaryDark: "#B91C1C",
  secondary: "#FFD166",
  secondaryDark: "#FFB703",
  success: "#06D6A0",
  successDark: "#04A77D",
  error: "#EF476F",
  info: "#118AB2",
  text: "#E8E9F3",
  textMuted: "#9B9DB5",
  textDisabled: "#5C5E78",
  border: "#3A3B5C",
  borderLight: "#2E2F50",
};

// COLORS è un oggetto mutabile che viene aggiornato dal ThemeProvider
export const COLORS = { ...LIGHT_COLORS };

export function applyTheme(dark: boolean) {
  const source = dark ? DARK_COLORS : LIGHT_COLORS;
  Object.assign(COLORS, source);
}

export const TORTELLINO_URL =
  "https://customer-assets.emergentagent.com/job_italian-learn-89/artifacts/atsmyzpg_IMG_4328.jpeg";
export const FONT = "System";