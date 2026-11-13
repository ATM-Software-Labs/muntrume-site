/**
 * Deterministic resource and event-listener lifecycle management.
 */

export interface Disposable {
  dispose(): void;
}

export class DisposableStore implements Disposable {
  private readonly items: Disposable[] = [];
  private disposed = false;

  get isDisposed(): boolean {
    return this.disposed;
  }

  add<T extends Disposable>(item: T): T {
    if (this.disposed) {
      item.dispose();
      return item;
    }
    this.items.push(item);
    return item;
  }

  addListener<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (ev: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): Disposable;
  addListener(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): Disposable;
  addListener(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): Disposable {
    target.addEventListener(type, listener, options);
    return this.add({
      dispose: () => target.removeEventListener(type, listener, options),
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    while (this.items.length > 0) {
      const item = this.items.pop();
      try {
        item?.dispose();
      } catch {
        // Ignore teardown errors to guarantee remaining disposables run.
      }
    }
  }
}
