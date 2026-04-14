export function normalizeApiDocsCategorySearchText(input: string): string {
  return input.toLowerCase().replace(/[\s\-/:_]+/g, '');
}

export function buildApiDocsCategorySearchText(category: {
  id: string;
  label: string;
}): string {
  return normalizeApiDocsCategorySearchText(`${category.label} ${category.id}`);
}
