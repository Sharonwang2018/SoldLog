export function isUsableContactHref(href?: string | null): href is string {
  if (!href || href === "#") return false;
  return /^mailto:|^tel:|^https?:\/\//i.test(href.trim());
}
