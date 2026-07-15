export type AuthorCertainty = 'certain' | 'joint' | 'disputed';

export function formatAuthorAttribution(author: string, certainty: AuthorCertainty) {
  const cleanAuthor = author.replace(/\s*\(attribution disputed\)\s*$/i, '').trim();

  if (certainty === 'disputed') {
    return `Commonly attributed to ${cleanAuthor}; authorship disputed.`;
  }

  return `Essay by ${cleanAuthor}.`;
}
