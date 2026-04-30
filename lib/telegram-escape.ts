const SPECIAL_CHARS = /[_*[\]()~>#+=|{}.!-]/g;

export function escapeMd(text: string): string {
  return text.replace(SPECIAL_CHARS, '\\$&');
}
