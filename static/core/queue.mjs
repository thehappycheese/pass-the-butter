/**
 * @template T
 */
export class Queue {
    /** @type {T[]} */
    #items = [];

    /**
     * Add a value to the back of the queue.
     * @param {T} value
     * @returns {void}
     */
    enqueue(value) {
        this.#items.push(value);
    }

    /**
     * Remove and return the value at the front of the queue.
     * @returns {T | undefined}
     */
    dequeue() {
        return this.#items.shift();
    }

    /**
     * Return the value at the front without removing it.
     * @returns {T | undefined}
     */
    peek() {
        return this.#items[0];
    }

    /** @returns {number} */
    get size() {
        return this.#items.length;
    }

    /** @returns {boolean} */
    empty() {
        return this.#items.length === 0;
    }

    /** @returns {boolean} */
    not_empty() {
        return this.#items.length > 0;
    }

    /**
     * Iterate front-to-back without mutating the queue.
     * @returns {IterableIterator<T>}
     */
    *[Symbol.iterator]() {
        yield* this.#items;
    }
}
