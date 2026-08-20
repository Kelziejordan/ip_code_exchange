import { Analytics } from '@vercel/analytics/next';
import "./globals.css";

export const metadata = {
  title: "IP Code Exchange",
  description: "AI-assisted IP commercialization and buyer discovery."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}<Analytics /></body></html>;
}
