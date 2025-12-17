import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Description Generator',
  description: 'AI-powered product description generator for B2B marketplace listings',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

