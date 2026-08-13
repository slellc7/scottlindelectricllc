import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/**
 * Blog posts — plain markdown in src/content/blog/.
 *
 * `draft: true` keeps a post out of the build entirely. That matters for the
 * AI publishing loop: generated posts land as drafts (or as a PR) and a person
 * flips the flag, rather than going straight live unreviewed.
 */
const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().max(70, 'Keep titles under ~70 chars so they survive the SERP'),
      description: z.string().min(80).max(165, 'Meta descriptions truncate past ~165 chars'),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      draft: z.boolean().default(false),
      tags: z.array(z.string()).default([]),
      heroImage: image().optional(),
      heroAlt: z.string().optional(),
    }),
});

export const collections = { blog };
