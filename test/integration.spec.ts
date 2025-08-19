/// <reference types="../worker-configuration" />

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
	processWithGemini,
	postGeminiResult,
	uploadFileWithUuid
} from '../src/index';

// GoogleGenerativeAI をモック
vi.mock('@google/generative-ai', () => ({
	GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
		getGenerativeModel: vi.fn().mockReturnValue({
			generateContent: vi.fn()
		})
	})),
	SchemaType: {
		OBJECT: 'object',
		STRING: 'string',
		BOOLEAN: 'boolean'
	}
}));

describe('Integration Tests', () => {
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
	});
	
	afterEach(() => {
		globalThis.fetch = originalFetch;
		globalThis.crypto = originalCrypto;
		vi.restoreAllMocks();
	});

	describe('processWithGemini', () => {
		it('processes attachment and posts result successfully', async () => {
			const mockEnv = {
				GOOGLE_GEMINI_API_KEY: 'test-api-key',
				MODEL: 'gemini-2.0-flash',
				CF_ACCOUNT_ID: 'test-account',
				GATEWAY_NAME: 'test-gateway',
				CF_POSTURL: 'https://example.com/api',
				CF_POST_DATA_URL: 'https://example.com/data',
				CF_ACCESS_CLIENT_ID: 'test-client-id',
				CF_ACCESS_CLIENT_SECRET: 'test-client-secret'
			} as Env;
			
			// fetch モック - すべての呼び出しに対して成功を返す
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				statusText: 'OK'
			});
			
			// Google Generative AI のモックを更新
			const { GoogleGenerativeAI } = await import('@google/generative-ai');
			(GoogleGenerativeAI as any).mockImplementation(() => ({
				getGenerativeModel: vi.fn().mockReturnValue({
					generateContent: vi.fn().mockResolvedValue({
						response: {
							candidates: [{
								content: {
									parts: [{
										text: JSON.stringify({
											CarId: 'TEST-123',
											ValidPeriodExpirdateE: 'R',
											ValidPeriodExpirdateY: '7',
											ValidPeriodExpirdateM: '1',
											ValidPeriodExpirdateD: '15',
											IsValidPeriodExpirdate: true,
											IsCarId: true
										})
									}]
								}
							}]
						}
					})
				})
			}));
			
			const attachment = {
				content: new ArrayBuffer(8),
				filename: 'test.pdf',
				mimeType: 'application/pdf'
			};
			
			// processWithGemini を実行
			await processWithGemini(mockEnv, attachment);
			
			// fetch が2回呼ばれたことを確認
			expect(globalThis.fetch).toHaveBeenCalledTimes(2);
			
			// 1回目の呼び出し（uploadFileWithUuid）
			const firstCall = (globalThis.fetch as any).mock.calls[0];
			expect(firstCall[0]).toBe(mockEnv.CF_POSTURL);
			
			// 2回目の呼び出し（postGeminiResult）
			const secondCall = (globalThis.fetch as any).mock.calls[1];
			expect(secondCall[0]).toBe(mockEnv.CF_POST_DATA_URL);
			expect(secondCall[1].headers['Content-Type']).toBe('application/json');
		});

		it('handles empty response from Gemini', async () => {
			const mockEnv = {
				GOOGLE_GEMINI_API_KEY: 'test-api-key',
				MODEL: 'gemini-2.0-flash',
				CF_ACCOUNT_ID: 'test-account',
				GATEWAY_NAME: 'test-gateway',
				CF_POSTURL: 'https://example.com/api',
				CF_POST_DATA_URL: 'https://example.com/data',
				CF_ACCESS_CLIENT_ID: 'test-client-id',
				CF_ACCESS_CLIENT_SECRET: 'test-client-secret'
			} as Env;
			
			// fetchのモックをリセット
			globalThis.fetch = vi.fn();
			
			// モジュールのモックをリセットして再度設定
			vi.resetModules();
			vi.doMock('@google/generative-ai', () => ({
				GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
					getGenerativeModel: vi.fn().mockReturnValue({
						generateContent: vi.fn().mockResolvedValue({
							response: {
								candidates: [{
									content: {
										parts: [{
											text: '' // 空の応答
										}]
									}
								}]
							}
						})
					})
				})),
				SchemaType: {
					OBJECT: 'object',
					STRING: 'string',
					BOOLEAN: 'boolean'
				}
			}));
			
			// processWithGeminiを再インポート
			const { processWithGemini } = await import('../src/index');
			
			const attachment = {
				content: new ArrayBuffer(8),
				filename: 'test.pdf',
				mimeType: 'application/pdf'
			};
			
			await processWithGemini(mockEnv, attachment);
			
			// fetch が呼ばれないことを確認（resultTextが空なので）
			expect(globalThis.fetch).not.toHaveBeenCalled();
		});

		it('throws error when Gemini API fails', async () => {
			const mockEnv = {
				GOOGLE_GEMINI_API_KEY: 'test-api-key',
				MODEL: 'gemini-2.0-flash',
				CF_ACCOUNT_ID: 'test-account',
				GATEWAY_NAME: 'test-gateway',
				CF_POSTURL: 'https://example.com/api',
				CF_POST_DATA_URL: 'https://example.com/data',
				CF_ACCESS_CLIENT_ID: 'test-client-id',
				CF_ACCESS_CLIENT_SECRET: 'test-client-secret'
			} as Env;
			
			// fetchのモックをリセット
			globalThis.fetch = vi.fn();
			
			// モジュールのモックをリセットして再度設定
			vi.resetModules();
			vi.doMock('@google/generative-ai', () => ({
				GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
					getGenerativeModel: vi.fn().mockReturnValue({
						generateContent: vi.fn().mockRejectedValue(new Error('API request failed'))
					})
				})),
				SchemaType: {
					OBJECT: 'object',
					STRING: 'string',
					BOOLEAN: 'boolean'
				}
			}));
			
			// processWithGeminiを再インポート
			const { processWithGemini } = await import('../src/index');
			
			const attachment = {
				content: new ArrayBuffer(8),
				filename: 'test.pdf',
				mimeType: 'application/pdf'
			};
			
			// エラーがスローされることを確認
			await expect(processWithGemini(mockEnv, attachment))
				.rejects.toThrow('API request failed');
			
			// fetch が呼ばれないことを確認
			expect(globalThis.fetch).not.toHaveBeenCalled();
		});
	});

	describe('postGeminiResult', () => {
		it('posts result successfully', async () => {
			const mockEnv = {
				CF_POST_DATA_URL: 'https://example.com/data',
				CF_ACCESS_CLIENT_ID: 'test-client-id',
				CF_ACCESS_CLIENT_SECRET: 'test-client-secret'
			} as Env;
			
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				statusText: 'OK'
			});
			
			const resultText = JSON.stringify({
				CarId: 'ABC-123',
				ValidPeriodExpirdateE: 'R',
				ValidPeriodExpirdateY: '7',
				ValidPeriodExpirdateM: '12',
				ValidPeriodExpirdateD: '31',
				IsValidPeriodExpirdate: true,
				IsCarId: true
			});
			
			await postGeminiResult(mockEnv, resultText, 'test-uuid');
			
			expect(globalThis.fetch).toHaveBeenCalledWith(
				mockEnv.CF_POST_DATA_URL,
				expect.objectContaining({
					method: 'POST',
					headers: {
						"Content-Type": "application/json",
						"CF-Access-Client-Id": mockEnv.CF_ACCESS_CLIENT_ID,
						"CF-Access-Client-Secret": mockEnv.CF_ACCESS_CLIENT_SECRET
					},
					body: expect.stringContaining('test-uuid')
				})
			);
		});

		it('throws error on 401 Unauthorized', async () => {
			const mockEnv = {
				CF_POST_DATA_URL: 'https://example.com/data',
				CF_ACCESS_CLIENT_ID: 'test-client-id',
				CF_ACCESS_CLIENT_SECRET: 'test-client-secret'
			} as Env;
			
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
				text: async () => 'Invalid credentials'
			});
			
			await expect(postGeminiResult(mockEnv, '{}', 'test-uuid'))
				.rejects.toThrow('Failed to post result: 401 Unauthorized');
		});

		it('throws error on network failure', async () => {
			const mockEnv = {
				CF_POST_DATA_URL: 'https://example.com/data',
				CF_ACCESS_CLIENT_ID: 'test-client-id',
				CF_ACCESS_CLIENT_SECRET: 'test-client-secret'
			} as Env;
			
			globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
			
			await expect(postGeminiResult(mockEnv, '{}', 'test-uuid'))
				.rejects.toThrow('Network error');
		});
	});

	describe('uploadFileWithUuid', () => {
		it('uploads file successfully', async () => {
			const mockEnv = {
				CF_POSTURL: 'https://example.com/api',
				CF_ACCESS_CLIENT_ID: 'test-client-id',
				CF_ACCESS_CLIENT_SECRET: 'test-client-secret'
			} as Env;
			
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				statusText: 'OK'
			});
			
			const fileContent = new ArrayBuffer(8);
			await uploadFileWithUuid(mockEnv, fileContent, 'test.pdf', 'application/pdf', 'test-uuid');
			
			expect(globalThis.fetch).toHaveBeenCalledWith(
				mockEnv.CF_POSTURL,
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						"CF-Access-Client-Id": mockEnv.CF_ACCESS_CLIENT_ID,
						"CF-Access-Client-Secret": mockEnv.CF_ACCESS_CLIENT_SECRET
					})
				})
			);
			
			// FormData が含まれていることを確認
			const callArgs = (globalThis.fetch as any).mock.calls[0];
			expect(callArgs[1].body).toBeInstanceOf(FormData);
		});

		it('throws error on 403 Forbidden', async () => {
			const mockEnv = {
				CF_POSTURL: 'https://example.com/api',
				CF_ACCESS_CLIENT_ID: 'test-client-id',
				CF_ACCESS_CLIENT_SECRET: 'test-client-secret'
			} as Env;
			
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 403,
				statusText: 'Forbidden'
			});
			
			await expect(uploadFileWithUuid(mockEnv, new ArrayBuffer(8), 'test.pdf', 'application/pdf', 'test-uuid'))
				.rejects.toThrow('Failed to upload file: 403 Forbidden');
		});

		it('throws error on 500 Internal Server Error', async () => {
			const mockEnv = {
				CF_POSTURL: 'https://example.com/api',
				CF_ACCESS_CLIENT_ID: 'test-client-id',
				CF_ACCESS_CLIENT_SECRET: 'test-client-secret'
			} as Env;
			
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error'
			});
			
			await expect(uploadFileWithUuid(mockEnv, new ArrayBuffer(8), 'test.pdf', 'application/pdf', 'test-uuid'))
				.rejects.toThrow('Failed to upload file: 500 Internal Server Error');
		});
	});

});