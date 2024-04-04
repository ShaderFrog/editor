export const hasParent = (
  element: HTMLElement | null,
  matcher: string
): boolean =>
  !element
    ? false
    : element.matches(matcher) || hasParent(element.parentElement, matcher);
