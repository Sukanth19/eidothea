import type { Metadata } from "next";
import { IBM_Plex_Mono, Special_Elite, VT323 } from "next/font/google";
import { Atmosphere, FxToggle } from "@/components/Atmosphere";
import { Nav } from "@/components/Nav";
import { currentUser } from "@/lib/server-api";
import "./globals.css";
import "./effects.css";

const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"], variable: "--font-plex" });
const elite = Special_Elite({ subsets: ["latin"], weight: "400", variable: "--font-elite" });
const vt = VT323({ subsets: ["latin"], weight: "400", variable: "--font-vt" });

export const metadata: Metadata = {
  title: { default: "The Unlit Archive", template: "%s · The Unlit Archive" },
  description: "An archive of creepypastas, recovered and new.",
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
