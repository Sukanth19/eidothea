import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Special_Elite, VT323 } from "next/font/google";
import { headers } from "next/headers";
import { Atmosphere, FxToggle } from "@/components/Atmosphere";
import { Nav } from "@/components/Nav";
import { currentUser } from "@/lib/server-api";
import "./globals.css";
import "./effects.css";

const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"], variable: "--font-plex" });
const elite = Special_Elite({ subsets: ["latin"], weight: "400", variable: "--font-elite" });
const vt = VT323({ subsets: ["latin"], weight: "400", variable: "--font-vt" });

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
  themeColor: "#0a0b09",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en" className={`${plex.variable} ${elite.variable} ${vt.variable}`} data-fx="on">
      <body>
        <Atmosphere>
          <Nav user={user} />
          <main className="view wrap">{children}</main>
          <footer className="site-footer">
            <div className="wrap">
              <span>TERMINAL 7 // STORIES FROM THE DAVIDGETTER1/CREEPYPASTAS DATASET + THE COMMUNITY</span>
              <FxToggle />
            </div>
          </footer>
        </Atmosphere>
      </body>
    </html>
  );
}
