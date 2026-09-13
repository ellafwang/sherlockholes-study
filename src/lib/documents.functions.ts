import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const imageSchema = z.object({
  /** A data URL: data:image/png;base64,… */
  dataUrl: z.string().min(32),
});

/** Reads handwritten or printed notes out of an uploaded image. */
export const readImageNotes = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => imageSchema.parse(input))
  .handler(async ({ data }): Promise<{ text: string }> => {
    const { readImageText } = await import("./ai.server");
    const text = await readImageText({
      dataUrl: data.dataUrl,
      instructions: `You transcribe study notes from images, including messy handwriting, whiteboards, scanned pages and photographed textbook pages.
Return ONLY the text that is actually present in the image: headings, sentences, formulas, table cells and diagram labels, in reading order.
Read handwriting as faithfully as you can; write formulas in LaTeX when they are mathematical.
Do not summarise, explain, correct or add anything that is not written in the image.
If a word is genuinely illegible, write [illegible] in its place.
If the image contains no readable text, return an empty response.`,
    });
    return { text: text.trim() };
  });
