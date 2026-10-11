import type { ReactNode } from "react";
import Footer from "../components/footer";
import Navbar from "../components/navbar";
import { AuthProvider } from "@/contexts/auth-context";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Navbar />
      {children}
      <Footer />
    </AuthProvider>
  );
}
