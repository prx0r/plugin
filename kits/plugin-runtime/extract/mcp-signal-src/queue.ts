import type { SignalEvent } from './types';

/**
 * A bounded FIFO event buffer. `drain()` atomically takes everything, which makes every
 * flush path (timer, size, manual, teardown) idempotent — two concurrent flushes can
 * never send the same event twice.
 */
export class EventQueue {
  private items: SignalEvent[] = [];

  constructor(
    private readonly maxSize: number,
    private readonly onDrop?: (dropped: number) => void,
  ) {}

  get length(): number {
    return this.items.length;
  }

  push(event: SignalEvent): void {
    this.items.push(event);
    if (this.items.length > this.maxSize) {
      const dropped = this.items.length - this.maxSize;
      this.items.splice(0, dropped);
      this.onDrop?.(dropped);
    }
  }

  drain(): SignalEvent[] {
    return this.items.splice(0, this.items.length);
  }
}
