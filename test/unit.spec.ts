import { describe, it, expect, vi } from 'vitest';
import { 
	arrayBufferToBase64, 
	base64ToArrayBuffer, 
	streamToArrayBuffer 
} from '../src/index';

describe('Unit Tests', () => {
	describe('arrayBufferToBase64', () => {
		it('converts ArrayBuffer to base64 string', () => {
			const buffer = new ArrayBuffer(4);
			const view = new Uint8Array(buffer);
			view[0] = 72; // H
			view[1] = 101; // e
			view[2] = 108; // l
			view[3] = 108; // l
			
			const result = arrayBufferToBase64(buffer);
			expect(result).toBe('SGVsbA=='); // "Hell" in base64
		});

		it('handles empty buffer', () => {
			const buffer = new ArrayBuffer(0);
			const result = arrayBufferToBase64(buffer);
			expect(result).toBe('');
		});

		it('handles large buffer', () => {
			const buffer = new ArrayBuffer(256);
			const view = new Uint8Array(buffer);
			for (let i = 0; i < 256; i++) {
				view[i] = i;
			}
			const result = arrayBufferToBase64(buffer);
			expect(result).toBeTruthy();
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe('base64ToArrayBuffer', () => {
		it('converts base64 string to ArrayBuffer', () => {
			const base64 = 'SGVsbA=='; // "Hell" in base64
			const result = base64ToArrayBuffer(base64);
			const view = new Uint8Array(result);
			
			expect(view.length).toBe(4);
			expect(view[0]).toBe(72); // H
			expect(view[1]).toBe(101); // e
			expect(view[2]).toBe(108); // l
			expect(view[3]).toBe(108); // l
		});

		it('handles empty string', () => {
			const result = base64ToArrayBuffer('');
			expect(result.byteLength).toBe(0);
		});

		it('handles special characters', () => {
			const base64 = 'dGVzdCArIC8gPQ=='; // "test + / =" in base64
			const result = base64ToArrayBuffer(base64);
			const view = new Uint8Array(result);
			expect(view.length).toBeGreaterThan(0);
		});
	});

	describe('streamToArrayBuffer', () => {
		it('converts ReadableStream to ArrayBuffer', async () => {
			const data = new Uint8Array([1, 2, 3, 4, 5]);
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue(data);
					controller.close();
				}
			});

			const result = await streamToArrayBuffer(stream, 5);
			expect(result).toEqual(data);
		});

		it('handles empty stream', async () => {
			const stream = new ReadableStream({
				start(controller) {
					controller.close();
				}
			});

			const result = await streamToArrayBuffer(stream, 0);
			expect(result.length).toBe(0);
		});

		it('handles stream with multiple chunks', async () => {
			const chunk1 = new Uint8Array([1, 2]);
			const chunk2 = new Uint8Array([3, 4]);
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue(chunk1);
					controller.enqueue(chunk2);
					controller.close();
				}
			});

			const result = await streamToArrayBuffer(stream, 4);
			expect(result).toEqual(new Uint8Array([1, 2, 3, 4]));
		});

		it('handles partial stream read', async () => {
			const data = new Uint8Array([1, 2, 3, 4, 5]);
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue(data.slice(0, 3));
					controller.enqueue(data.slice(3));
					controller.close();
				}
			});

			const result = await streamToArrayBuffer(stream, 5);
			expect(result).toEqual(data);
		});
	});
});