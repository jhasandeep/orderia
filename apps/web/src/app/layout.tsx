import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Nav } from "@/components/Nav";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: { default: "Orderia: book appointments, rooms and tables", template: "%s · Orderia" },
  description: "Book salons, parlours, doctors, hotel rooms and restaurant tables in one place. Order by QR and pay by UPI or card.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <AuthProvider>
          <Nav />
          <main>{children}</main>
          <footer className="mt-16 border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">Orderia · Appointments, tables and payments for every kind of business</footer>
        </AuthProvider>
      </body>
    </html>
  );
}
