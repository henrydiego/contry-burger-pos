import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Contry Burger - Sistema POS",
  description: "Sistema POS y ERP para Contry Burger",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </body>
    </html>
  );
}
