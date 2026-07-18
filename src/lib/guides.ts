import { getCollection, type CollectionEntry } from 'astro:content';

export type Guide = CollectionEntry<'guides'>;

export async function getOrderedGuides(): Promise<Guide[]> {
  const guides = await getCollection('guides');
  return guides.sort((a, b) => a.data.order - b.data.order);
}

// Theme guides that include a given paper number, in display order.
export async function getThemeGuidesForPaper(number: number): Promise<Guide[]> {
  const guides = await getOrderedGuides();
  return guides.filter(
    (g) => g.data.kind === 'theme' && g.data.papers.some((p) => p.number === number)
  );
}
