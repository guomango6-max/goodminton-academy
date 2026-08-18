/**
 * Return a newest-first copy of a combined forum feed.
 * `sortAt` must be the same date that the card shows to the reader.
 * 置顶（pinned）优先：加精置顶的帖子排在最前，其余按 sortAt 倒序。
 */
export function sortForumFeedEntries(entries) {
  return [...entries].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return right.sortAt.localeCompare(left.sortAt);
  });
}

export function getForumPublishedDateLabel(item) {
  return item.featuredAt.slice(0, 10);
}
