import type { Metadata } from "next";
import "@fontsource-variable/space-grotesk/wght.css";
import "../../styles/globals.css";
import AdminLayout from "../components/layout-shell";
import Providers from "../components/providers";
import { ErrorHandler } from "./error-handler";
export const metadata: Metadata = {
    title: "SUPER_TRUTH // Command Center",
    description: "Independent Operator Management System",
};
export default function RootLayout({ children, }: Readonly<{
    children: React.ReactNode;
}>) {
    return (<html lang="en">
      <body className="font-mono">
        <ErrorHandler />
        <Providers>
          <AdminLayout>{children}</AdminLayout>
        </Providers>
      </body>
    </html>);
}
