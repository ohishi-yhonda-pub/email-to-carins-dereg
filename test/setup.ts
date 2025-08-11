import { beforeAll } from 'vitest';

// グローバルなEBUSY警告の抑制
beforeAll(() => {
	// Node.js環境でのみ実行
	if (typeof process !== 'undefined' && process.stderr && process.stdout) {
		// EBUSY警告を完全に抑制
		const originalStderr = process.stderr.write;
		const originalStdout = process.stdout.write;
		
		const suppressEBUSY = (chunk: any): boolean => {
			const str = chunk?.toString() || '';
			return str.includes('Unable to remove temporary directory') && str.includes('EBUSY');
		};

		if (originalStderr) {
			process.stderr.write = function(chunk: any, ...args: any[]): boolean {
				if (suppressEBUSY(chunk)) return true;
				return originalStderr.apply(process.stderr, [chunk, ...args] as any);
			} as any;
		}

		if (originalStdout) {
			process.stdout.write = function(chunk: any, ...args: any[]): boolean {
				if (suppressEBUSY(chunk)) return true;
				return originalStdout.apply(process.stdout, [chunk, ...args] as any);
			} as any;
		}
	}

	// consoleメソッドは常に利用可能なので抑制
	const originalLog = console.log;
	const originalError = console.error;
	const originalWarn = console.warn;

	console.log = (...args: any[]) => {
		if (args.some(arg => String(arg).includes('Unable to remove temporary directory'))) return;
		originalLog(...args);
	};

	console.error = (...args: any[]) => {
		if (args.some(arg => String(arg).includes('Unable to remove temporary directory'))) return;
		originalError(...args);
	};

	console.warn = (...args: any[]) => {
		if (args.some(arg => String(arg).includes('Unable to remove temporary directory'))) return;
		originalWarn(...args);
	};
});