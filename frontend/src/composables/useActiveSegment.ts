import type { TranscriptSegment } from '@/types/domain'

/**
 * 求当前播放时间命中的字幕段下标（最后一个 start <= time 的段）。
 * 有序区间上二分查找，O(log n)；句间空隙保留上一句高亮（字幕软件的惯例）。
 * 返回 -1 表示时间在第一句之前。
 */
export function findSegmentIndexAt(segments: TranscriptSegment[], time: number): number {
  let lo = 0
  let hi = segments.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const segment = segments[mid]
    if (segment && segment.start <= time) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}
