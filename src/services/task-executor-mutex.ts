/**
 * 异步互斥队列
 * MV3 扩展单线程，但 await 会使多个执行流程交错，临界区必须串行才能保证原子性。
 */
export class Mutex {
  private tail: Promise<void> = Promise.resolve();

  /**
   * 串行执行临界区
   * 链式队列保证同一时刻只有一个临界区在运行；fn 抛出异常时同样释放互斥，
   * 避免后续临界区永久等待
   * @param fn 需要互斥执行的异步操作
   * @returns fn 的执行结果
   */
  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.tail;
    let release!: () => void;
    this.tail = new Promise(r => (release = r));
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
