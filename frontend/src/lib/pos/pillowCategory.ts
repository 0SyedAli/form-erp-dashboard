export function isPillowCategory(name?: string): boolean {
  return /^pillows?$/i.test(name?.trim() ?? '');
}
