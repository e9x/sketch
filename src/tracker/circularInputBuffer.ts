/*
Data:

int distance;
char flags;
*/

const dataSize = 4 + 1;

// optimize call (tampermonkey is slow)
const { DataView } = window;

/**
 * Circular buffer
 */
export default class CircularInputBuffer {
  length: number;
  data: Uint8Array;
  constructor(length: number) {
    this.length = length;
    this.data = new Uint8Array(this.length * dataSize);
  }
  *[Symbol.iterator]() {
    for (let i = 0; i < this.length; i++) {
      const view = new DataView(this.data.buffer, i * dataSize, dataSize);
      const distance = view.getUint32(0, true) / 1000;
      const flags = view.getUint8(4);
      yield { i, distance, flags };
    }
  }
  /**
   * Shift everything in the buffer to the right.
   */
  shiftRight() {
    // Copy memory from the beginning of the data array to index 'dataSize'
    this.data.copyWithin(dataSize, 0, this.data.byteLength - dataSize);
  }
  /**
   * Shift everything in the buffer to the left.
   */
  shiftLeft() {
    // Copy memory from index 'dataSize' to the end of the data array to the beginning
    this.data.copyWithin(0, dataSize, this.data.byteLength);
  }
  /**
   * Add the new data to the start of the buffer.
   */
  add(distance: number, flags: number) {
    this.shiftRight();

    // add mouse and flags as the first element in data
    const view = new DataView(this.data.buffer, 0, dataSize);
    view.setUint32(0, distance * 1000, true);
    view.setUint8(4, flags);
  }
  /**
   *Add the new data to the end of the buffer.
   */
  push(distance: number, flags: number) {
    this.shiftLeft();

    // add distance and flags as the last element in data
    const view = new DataView(
      this.data.buffer,
      (this.length - 1) * dataSize,
      dataSize
    );
    view.setUint32(0, distance * 1000, true);
    view.setUint8(4, flags);
  }
}
