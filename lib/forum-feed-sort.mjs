/**
 * Return a newest-first copy of a combined forum feed.
 * `sortAt` must be the same date that the card shows to the reader.
 */
export function sortForumFeedEntries(entries) {
  return [...entries].sort((left, right) =>
    right.sortAt.localeCompare(left.sortAt),
  );
}

export function getForumPublishedDateLabel(item) {
  return item.featuredAt.slice(0, 10);
}
