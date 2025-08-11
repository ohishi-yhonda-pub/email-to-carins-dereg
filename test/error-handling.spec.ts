import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processWithGemini } from '../src/index';

// GoogleGenerativeAI をモック
vi.mock('@google/generative-ai', () => ({
	GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
		getGenerativeModel: vi.fn().mockReturnValue({
			generateContent: vi.fn().mockRejectedValue(new Error('Gemini API error'))
		})
	})),
	SchemaType: {
		OBJECT: 'object',
		STRING: 'string',
		BOOLEAN: 'boolean'
	}
}));

describe('Error Handling Tests', () => {
	let originalFetch: typeof globalThis.fetch;
	let originalCrypto: typeof globalThis.crypto;
	
	beforeEach(() => {
		vi.clearAllMocks();
		originalFetch = globalThis.fetch;
		originalCrypto = globalThis.crypto;
		
		vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		
		// crypto モック
		globalThis.crypto = {
			randomUUID: vi.fn().mockReturnValue('test-uuid-123')
		} as any;
		
		// fetch モック
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: 'OK'
		});
	});
	
	afterEach(() => {
		globalThis.fetch = originalFetch;
		globalThis.crypto = originalCrypto;
		vi.restoreAllMocks();
	});

	it('processWithGemini handles generateContent error', async () => {
		const mockEnv = {
			GOOGLE_GEMINI_API_KEY: 'test-api-key',
			MODEL: 'gemini-2.0-flash',
			CF_ACCOUNT_ID: 'test-account',
			GATEWAY_NAME: 'test-gateway',
			CF_POSTURL: 'https://example.com/api',
			CF_ACCESS_CLIENT_ID: 'test-client-id',
			CF_ACCESS_CLIENT_SECRET: 'test-client-secret'
		} as Env;
		
		const attachment = {
			content: new ArrayBuffer(8),
			filename: 'test.pdf',
			mimeType: 'application/pdf'
		};
		
		// processWithGemini がエラーをスローすることを期待
		await expect(processWithGemini(mockEnv, attachment))
			.rejects.toThrow('Gemini API error');
		
		// fetch は呼ばれないはず（Gemini APIでエラーが発生するため）
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

});