import './styles.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'simplei18n react-server',
  description: 'simplei18n react-server integration example using vinext',
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang='en'>
      <body>{children}</body>
    </html>
  );
}
