import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/auth-context";
import "./globals.css";

const toasterStyle = {
  zIndex: 1100,
  "--success-bg": "#E8F7ED",
  "--success-border": "#22A05A",
  "--success-text": "#166534",
  "--error-bg": "#FEECEC",
  "--error-border": "#DC2626",
  "--error-text": "#991B1B",
  "--warning-bg": "#FFF5DB",
  "--warning-border": "#D97706",
  "--warning-text": "#92400E",
  "--info-bg": "#EAF3FF",
  "--info-border": "#2563EB",
  "--info-text": "#1D4ED8",
} as CSSProperties;

export const metadata: Metadata = {
  title: "PickleCourt | Pickleball Court Booking",
  description: "Discover indoor and outdoor pickleball courts, explore available schedules, and plan your next game with PickleCourt.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-screen flex-col">
        <AuthProvider>{children}</AuthProvider>
        <Toaster
          position="top-center"
          theme="light"
          richColors
          closeButton
          expand={false}
          visibleToasts={3}
          offset="16px"
          mobileOffset={{ top: 12, left: 12, right: 12 }}
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: 14,
              padding: "12px 16px",
              boxShadow: "0 8px 28px rgb(31 41 55 / 12%)",
              maxWidth: "calc(100vw - 24px)",
            },
          }}
          style={toasterStyle}
        />
      </body>
    </html>
  );
}
