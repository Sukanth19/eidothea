import type { Metadata, Viewport } from "next";
import { EB_Garamond, IM_Fell_English_SC, Special_Elite } from "next/font/google";
import { headers } from "next/headers";
import { Atmosphere, FxToggle } from "@/components/Atmosphere";
import { EmailBanner } from "@/components/EmailBanner";
import { Nav } from "@/components/Nav";
import { Tracker } from "@/components/Tracker";
import Link from "next/link";
import { currentUser } from "@/lib/server-api";
import "./globals.css";
import "./effects.css";

const garamond = EB_Garamond({ subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"], variable: "--font-garamond" });
const elite = Special_Elite({ subsets: ["latin"], weight: "400", variable: "--font-elite" });
const fell = IM_Fell_English_SC({ subsets: ["latin"], weight: "400", variable: "--font-fell" });

export async function generateMetadata(): Promise<Metadata> {
  // Link previews need absolute image URLs; build them from the address the visitor used
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return {
    metadataBase: new URL(`${proto}://${host}`),
    title: { default: "Eidothea", template: "%s · Eidothea" },
    description: "An archive of creepypastas, recovered and new.",
    openGraph: { siteName: "Eidothea", type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw under the iPhone notch and home bar; the CSS pads with safe-area insets
  viewportFit: "cover",
  themeColor: "#0c0a0b",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en" className={`${garamond.variable} ${elite.variable} ${fell.variable}`} data-fx="on">
      <body>
        <Atmosphere>
          <Tracker />
          <Nav user={user} />
          <EmailBanner user={user} />
          <main className="view wrap">{children}</main>
          <footer className="site-footer">
            <div className="wrap">
              <span>THE EIDOTHEA ARCHIVE · STORIES FROM THE DAVIDGETTER1/CREEPYPASTAS DATASET & THE COMMUNITY</span>
              <span className="footer-links">
                <Link href="/privacy">PRIVACY</Link>
                <FxToggle />
              </span>
            </div>
          </footer>
        </Atmosphere>
      </body>
    </html>
  );
}
