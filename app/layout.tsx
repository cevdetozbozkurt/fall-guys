import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  icons: { icon: '/favicon.svg' },
  title: 'Tumble Club — Ready, Set, Tumble',
  description:
    'Jump, dive, and tumble through ten original 3D obstacle courses. Race the field or take on the full championship.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
