export function orderBoardScrollMetrics(element: { scrollWidth: number; clientWidth: number; scrollLeft: number }) {
  const maximum = Math.max(0, element.scrollWidth - element.clientWidth);
  const position = Math.min(maximum, Math.max(0, Math.round(element.scrollLeft)));
  return { maximum, position };
}
