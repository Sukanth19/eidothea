"use client";

import { ReaderContext } from "./LiveText";
import { Markup } from "./Markup";

/** A few lines of story with their commands played out, as `reader` would see them. */
export function LivePreview({ text, reader, reread = false }: { text: string; reader?: string; reread?: boolean }) {
  return (
    <ReaderContext.Provider value={{ name: reader, reread }}>
      <Markup text={text} live />
    </ReaderContext.Provider>
  );
}
