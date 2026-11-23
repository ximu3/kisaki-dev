/** @fileoverview Prefix sums of estimated and measured row sizes for one vertical layout. */

/** Indexes positive row heights with logarithmic position lookup and measurement updates. */
export class RowGeometry {
  private readonly tree: Float64Array
  private readonly sizes: Float64Array

  constructor(count: number, estimate: (index: number) => number) {
    this.sizes = Float64Array.from({ length: count }, (_, index) => estimate(index))
    this.tree = new Float64Array(count + 1)

    for (let i = 1; i <= count; i++) {
      this.tree[i] = this.tree[i]! + this.sizes[i - 1]!
      const parent = i + (i & -i)
      if (parent <= count) {
        this.tree[parent] = this.tree[parent]! + this.tree[i]!
      }
    }
  }

  /** Returns the start of a row, or the total height at the end of the index. */
  offset(index: number): number {
    let sum = 0
    for (let i = index; i > 0; i -= i & -i) {
      sum += this.tree[i]!
    }
    return sum
  }

  /** Finds the row containing a scroll offset. The end position is the row count. */
  at(position: number): number {
    let index = 0
    for (let step = 2 ** Math.floor(Math.log2(this.sizes.length || 1)); step >= 1; step /= 2) {
      const next = index + step
      if (next < this.tree.length && this.tree[next]! <= position) {
        position -= this.tree[next]!
        index = next
      }
    }
    return index
  }

  /** Applies a measured height and returns its signed change in pixels. */
  measure(index: number, size: number): number {
    const delta = size - this.sizes[index]!
    if (delta) {
      this.sizes[index] = size
      for (let i = index + 1; i < this.tree.length; i += i & -i) {
        this.tree[i] = this.tree[i]! + delta
      }
    }
    return delta
  }
}
