import { browser } from 'wxt/browser';
import { BOOKMARK_WRITE_LEASE_KEY } from './task-executor-types';
import {
  SELF_WRITE_EVENT_SUPPRESSION_MS,
  isRecentSelfWriteCompletion,
  releaseBookmarkWriteLease,
  tryAcquireBookmarkWriteLease,
} from './task-executor-lease';
import { BOOKMARK_WRITE_LEASE_LOCK_NAME } from './lease-lock';

// 可控排队，用于模拟执行过程中挂起
const createDeferred = <T = void>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

interface LockRequestRecord {
  name: string;
  mode: string;
}

/**
 * 模拟跨上下文共享的 Web Locks：同名锁按请求顺序串行
 * 同一名称的第二个请求在第一个回调结束后才会执行
 */
class FakeLockManager {
  readonly requests: LockRequestRecord[] = [];
  private tails = new Map<string, Promise<void>>();

  request<T>(name: string, options: LockOptions, callback: () => Promise<T>): Promise<T> {
    this.requests.push({ name, mode: options.mode ?? 'exclusive' });

    const previous = this.tails.get(name) ?? Promise.resolve();
    let releaseCurrent!: () => void;
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    this.tails.set(name, previous.then(() => current));

    return previous.then(async () => {
      try {
        return await callback();
      } finally {
        releaseCurrent();
      }
    });
  }
}

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

function installNavigatorLocks(locks?: FakeLockManager): void {
  Object.defineProperty(globalThis, 'navigator', {
    value: locks ? { locks } : {},
    configurable: true,
    writable: true,
  });
}

describe('书签写入租约跨上下文互斥', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.sync.clear();
  });

  afterEach(() => {
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
    } else {
      delete (globalThis as { navigator?: unknown }).navigator;
    }
  });

  test('其他上下文持有写入锁时，检查-获取等待锁释放后才写入租约', async () => {
    const locks = new FakeLockManager();
    installNavigatorLocks(locks);

    const foreignHeld = createDeferred();
    const foreignGate = createDeferred();
    const foreignRequest = locks.request(
      BOOKMARK_WRITE_LEASE_LOCK_NAME,
      { mode: 'exclusive' },
      async () => {
        foreignHeld.resolve();
        await foreignGate.promise;
      }
    );
    await foreignHeld.promise;

    let settled = false;
    const acquiring = tryAcquireBookmarkWriteLease('task_a', 'exec_a').then((result) => {
      settled = true;
      return result;
    });

    // 锁被其他上下文持有期间不得完成检查-获取，也不得写入租约
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false);
    const before = await browser.storage.local.get(BOOKMARK_WRITE_LEASE_KEY);
    expect(before[BOOKMARK_WRITE_LEASE_KEY]).toBeUndefined();

    foreignGate.resolve();
    await foreignRequest;

    await expect(acquiring).resolves.toEqual({ success: true, denied: false });
    // 获取请求在外部持有者之后排队，使用同一资源锁名与独占模式
    expect(locks.requests[1]).toEqual({
      name: BOOKMARK_WRITE_LEASE_LOCK_NAME,
      mode: 'exclusive',
    });

    await releaseBookmarkWriteLease('exec_a');
  });

  test('同一上下文并发获取写入租约时仅一个成功，另一个被拒', async () => {
    installNavigatorLocks(new FakeLockManager());

    const [first, second] = await Promise.all([
      tryAcquireBookmarkWriteLease('task_first', 'exec_first'),
      tryAcquireBookmarkWriteLease('task_second', 'exec_second'),
    ]);

    expect(first.success).toBe(true);
    expect(second).toEqual({ success: false, denied: true });

    await releaseBookmarkWriteLease('exec_first');
  });

  test('环境不支持 navigator.locks 时回退本地互斥，行为不变', async () => {
    installNavigatorLocks();

    const [first, second] = await Promise.all([
      tryAcquireBookmarkWriteLease('fallback_first', 'fallback_exec_first'),
      tryAcquireBookmarkWriteLease('fallback_second', 'fallback_exec_second'),
    ]);

    expect(first.success).toBe(true);
    expect(second).toEqual({ success: false, denied: true });

    // 释放后同一回退锁可再次获取
    await releaseBookmarkWriteLease('fallback_exec_first');
    await expect(
      tryAcquireBookmarkWriteLease('fallback_third', 'fallback_exec_third')
    ).resolves.toEqual({ success: true, denied: false });

    await releaseBookmarkWriteLease('fallback_exec_third');
  });
});

describe('任务自身写入完成时间', () => {
  const setWriteLease = async (taskId: string, executionId: string): Promise<void> => {
    await browser.storage.local.set({
      [BOOKMARK_WRITE_LEASE_KEY]: {
        taskId,
        executionId,
        acquiredAt: Date.now(),
        expiresAt: Date.now() + 120000,
      },
    });
  };

  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.sync.clear();
    installNavigatorLocks();
  });

  afterEach(() => {
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
    } else {
      delete (globalThis as { navigator?: unknown }).navigator;
    }
  });

  test('释放写入租约后记录完成时间，窗口内仅命中同一任务', async () => {
    const taskId = 'self_write_tracked_task';
    await setWriteLease(taskId, 'self_write_exec');

    const releasedAt = Date.now();
    await releaseBookmarkWriteLease('self_write_exec');

    expect(isRecentSelfWriteCompletion(taskId, releasedAt)).toBe(true);
    expect(isRecentSelfWriteCompletion('other_task', releasedAt)).toBe(false);
    expect(isRecentSelfWriteCompletion(taskId, releasedAt + SELF_WRITE_EVENT_SUPPRESSION_MS)).toBe(false);
  });

  test('执行ID不匹配时不记录完成时间', async () => {
    const taskId = 'self_write_mismatch_task';
    await setWriteLease(taskId, 'holder_exec');

    await releaseBookmarkWriteLease('another_exec');

    expect(isRecentSelfWriteCompletion(taskId, Date.now())).toBe(false);
    // 不匹配的执行不得删除租约
    const stored = await browser.storage.local.get(BOOKMARK_WRITE_LEASE_KEY);
    const lease = (stored as Record<string, { executionId: string }>)[BOOKMARK_WRITE_LEASE_KEY];
    expect(lease.executionId).toBe('holder_exec');
  });
});
