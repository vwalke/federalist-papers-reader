import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const sourceSchema = z.object({
  label: z.string().min(1),
  url: z.url()
});

const papers = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/papers' }),
  schema: z.object({
    number: z.number().int().min(1).max(85),
    title: z.string().min(1),
    author: z.string().min(1),
    authorCertainty: z.enum(['certain', 'joint', 'disputed']),
    publicationKind: z.enum(['newspaper', 'book']),
    publicationVenue: z.string().min(1),
    publicationDate: z.string().regex(/^178[78]-\d{2}-\d{2}$/),
    publicationDateLabel: z.string().min(1),
    recipient: z.string().min(1),
    indexSummary: z.string().min(1),
    nutshell: z.string().min(1),
    keyArguments: z.array(z.string().min(1)).min(3).max(5),
    whyItMattered: z.string(),
    talkItOver: z.string().min(1),
    sources: z.array(sourceSchema).min(1)
  })
});

export const collections = { papers };
