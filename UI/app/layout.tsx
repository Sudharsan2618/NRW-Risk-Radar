import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { TourProvider } from '@/contexts/TourContext';
import { AnalyticsProvider } from '@/components/AnalyticsProvider';

export const metadata: Metadata = {
  title: 'SWARION - Sales Automation. Reimagined',
  description: 'AI-powered B2B Sales CRM by Agamx Technology Solutions',
  icons: {
    icon: '/image.png',
    shortcut: '/image.png',
    apple: '/image.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {/* Inside AuthProvider so it can mirror the signed-in user into
              PostHog; outside everything else so pageviews cover all routes. */}
          <AnalyticsProvider>
            <TourProvider>{children}</TourProvider>
          </AnalyticsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
