import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { googleWorkflow, base64ToArrayBuffer } from '../src/index';
import * as srcIndex from '../src/index';

// GoogleGenerativeAI をモック
vi.mock('@google/generative-ai', () => ({
	GoogleGenerativeAI: vi.fn(),
	SchemaType: {
		OBJECT: 'object',
		STRING: 'string',
		BOOLEAN: 'boolean'
	}
}));

describe('Workflow Tests', () => {
	let originalFetch: typeof globalThis.fetch;


	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, 'log').mockImplementation(() => { });
		vi.spyOn(console, 'error').mockImplementation(() => { });

		// Save original fetch
		originalFetch = globalThis.fetch;
		// Mock global fetch to prevent actual API calls
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: 'OK'
		});
	});

	afterEach(async () => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
		// Allow Miniflare to release resources
		await new Promise(resolve => setTimeout(resolve, 50));
	});

	describe('googleWorkflow', () => {
		it('is a valid WorkflowEntrypoint', () => {
			expect(googleWorkflow).toBeDefined();
			expect(googleWorkflow.prototype).toBeDefined();
			expect(googleWorkflow.prototype.run).toBeDefined();
			expect(typeof googleWorkflow.prototype.run).toBe('function');
		});

		it('executes workflow steps in correct order', async () => {
			// GoogleGenerativeAI モックが成功レスポンスを返すように設定
			const { GoogleGenerativeAI } = await import('@google/generative-ai');
			(GoogleGenerativeAI as any).mockImplementation(() => ({
				getGenerativeModel: vi.fn().mockReturnValue({
					generateContent: vi.fn().mockResolvedValue({
						response: {
							text: () => JSON.stringify({
								CarId: 'TEST-123',
								ValidPeriodExpirdateE: '令和',
								ValidPeriodExpirdateY: '6',
								ValidPeriodExpirdateM: '12',
								ValidPeriodExpirdateD: '31',
								IsValidPeriodExpirdate: true,
								IsCarId: true
							})
						}
					})
				})
			}));

			const mockEnv = {
				MODEL: 'gemini-2.0-flash',
				GOOGLE_GEMINI_API_KEY: 'test-key',
				CF_ACCOUNT_ID: 'test-account',
				GATEWAY_NAME: 'test-gateway',
				CF_POSTURL: 'https://example.com',
				CF_ACCESS_CLIENT_ID: 'test-id',
				CF_ACCESS_CLIENT_SECRET: 'test-secret'
			};

			const mockEvent = {
				payload: {
					attachmentsData: [{
						filename: 'test.pdf',
						mimeType: 'application/pdf',
						contentBase64: 'dGVzdA==' // "test" in base64
					}],
					messageId: 'test-message-id'
				}
			};

			const executedSteps: string[] = [];
			const mockStep = {
				do: vi.fn().mockImplementation(async (name, optionsOrCallback, callback) => {
					executedSteps.push(name);
					const actualCallback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;

					if (name === 'decode-attachments') {
						return [{
							filename: 'test.pdf',
							content: base64ToArrayBuffer('dGVzdA=='),
							mimeType: 'application/pdf'
						}];
					} else if (name === 'process-attachment-content') {
						await actualCallback();
					} else if (name === 'final-step') {
						await actualCallback();
					}
				})
			};

			const workflow = googleWorkflow.prototype;
			await workflow.run.call({ env: mockEnv }, mockEvent, mockStep);

			// ステップが正しい順序で実行されたことを確認
			expect(executedSteps).toEqual(['decode-attachments', 'process-attachment-content', 'final-step']);
			expect(mockStep.do).toHaveBeenCalledTimes(3);
		});


		it('handles attachment without content (null content)', async () => {
			const mockEnv = {
				MODEL: 'gemini-2.0-flash',
				GOOGLE_GEMINI_API_KEY: 'test-key',
				CF_ACCOUNT_ID: 'test-account',
				GATEWAY_NAME: 'test-gateway',
				CF_POSTURL: 'https://example.com',
				CF_ACCESS_CLIENT_ID: 'test-id',
				CF_ACCESS_CLIENT_SECRET: 'test-secret'
			};

			const mockEvent = {
				payload: {
					attachmentsData: [{
						filename: 'test.pdf',
						mimeType: 'application/pdf',
						contentBase64: 'dGVzdA=='
					}],
					messageId: 'test-message-id'
				}
			};

			let processStepCalled = false;
			const mockStep = {
				do: vi.fn().mockImplementation(async (name, optionsOrCallback, callback) => {
					const actualCallback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;

					if (name === 'decode-attachments') {
						// content を null にして返す
						return [{
							filename: 'test.pdf',
							content: null,
							mimeType: 'application/pdf'
						}];
					} else if (name === 'process-attachment-content') {
						processStepCalled = true;
						await actualCallback();
					} else if (name === 'final-step') {
						await actualCallback();
					}
				})
			};

			const workflow = googleWorkflow.prototype;
			await workflow.run.call({ env: mockEnv }, mockEvent, mockStep);

			// ワークフローが正常に完了したことを確認
			expect(mockStep.do).toHaveBeenCalledTimes(3);
			expect(processStepCalled).toBe(true);
		});

		it('handles attachment with undefined content', async () => {
			const mockEnv = {
				MODEL: 'gemini-2.0-flash',
				GOOGLE_GEMINI_API_KEY: 'test-key',
				CF_ACCOUNT_ID: 'test-account',
				GATEWAY_NAME: 'test-gateway',
				CF_POSTURL: 'https://example.com',
				CF_ACCESS_CLIENT_ID: 'test-id',
				CF_ACCESS_CLIENT_SECRET: 'test-secret'
			};

			const mockEvent = {
				payload: {
					attachmentsData: [{
						filename: 'test2.pdf',
						mimeType: 'application/pdf',
						contentBase64: 'dGVzdA=='
					}],
					messageId: 'test-message-id-2'
				}
			};

			const mockStep = {
				do: vi.fn().mockImplementation(async (name, optionsOrCallback, callback) => {
					const actualCallback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;

					if (name === 'decode-attachments') {
						// content が undefined の添付ファイル
						return [{
							filename: 'test2.pdf',
							content: undefined,
							mimeType: 'application/pdf'
						}];
					} else if (name === 'process-attachment-content') {
						await actualCallback();
					} else if (name === 'final-step') {
						await actualCallback();
					}
				})
			};

			const workflow = googleWorkflow.prototype;
			await workflow.run.call({ env: mockEnv }, mockEvent, mockStep);

			// ワークフローが正常に完了したことを確認
			expect(mockStep.do).toHaveBeenCalledTimes(3);
		});

		it('handles processWithGemini error in workflow', async () => {
			// GoogleGenerativeAI モックがエラーを返すように設定
			const { GoogleGenerativeAI } = await import('@google/generative-ai');
			(GoogleGenerativeAI as any).mockImplementation(() => ({
				getGenerativeModel: vi.fn().mockReturnValue({
					generateContent: vi.fn().mockRejectedValue(new Error('Gemini API error'))
				})
			}));

			const mockEnv = {
				MODEL: 'gemini-2.0-flash',
				GOOGLE_GEMINI_API_KEY: 'test-key',
				CF_ACCOUNT_ID: 'test-account',
				GATEWAY_NAME: 'test-gateway',
				CF_POSTURL: 'https://example.com',
				CF_ACCESS_CLIENT_ID: 'test-id',
				CF_ACCESS_CLIENT_SECRET: 'test-secret'
			};

			const mockEvent = {
				payload: {
					attachmentsData: [{
						filename: 'test.pdf',
						mimeType: 'application/pdf',
						contentBase64: 'dGVzdA=='
					}],
					messageId: 'test-message-id'
				}
			};

			let stepError: Error | null = null;
			const mockStep = {
				do: vi.fn().mockImplementation(async (name, optionsOrCallback, callback) => {
					const actualCallback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;

					if (name === 'decode-attachments') {
						return [{
							filename: 'test.pdf',
							content: base64ToArrayBuffer('dGVzdA=='),
							mimeType: 'application/pdf'
						}];
					} else if (name === 'process-attachment-content') {
						try {
							await actualCallback();
						} catch (error) {
							stepError = error as Error;
							// Don't re-throw - let the workflow continue to see the error was handled
						}
					} else if (name === 'final-step') {
						await actualCallback();
					}
				})
			};

			const workflow = googleWorkflow.prototype;

			// ワークフローを実行
			try {
				await workflow.run.call({ env: mockEnv }, mockEvent, mockStep);
			} catch (error) {
				// エラーはステップレベルで処理される
			}

			// Wait a bit for async operations to complete
			await new Promise(resolve => setTimeout(resolve, 100));

			// エラーが正しく処理されたことを確認
			expect(stepError).not.toBeNull();
			expect(stepError).toBeInstanceOf(Error);
			expect(stepError).toBeDefined();
			if (stepError) {
				expect((stepError as Error).message).toBe('Failed to generate content from attachments.');
			} else {
				// エラーが発生しなかった場合は、テストを失敗させる
				throw new Error('Expected an error to be thrown');
			}
		});


		it('handles empty attachments list', async () => {
			const mockEnv = {
				MODEL: 'gemini-2.0-flash',
				GOOGLE_GEMINI_API_KEY: 'test-key',
				CF_ACCOUNT_ID: 'test-account',
				GATEWAY_NAME: 'test-gateway',
				CF_POSTURL: 'https://example.com',
				CF_ACCESS_CLIENT_ID: 'test-id',
				CF_ACCESS_CLIENT_SECRET: 'test-secret'
			};

			const mockEvent = {
				payload: {
					attachmentsData: [],
					messageId: 'test-message-id'
				}
			};

			const mockStep = {
				do: vi.fn().mockImplementation(async (name, optionsOrCallback, callback) => {
					const actualCallback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;

					if (name === 'decode-attachments') {
						return [];
					} else if (name === 'process-attachment-content') {
						await actualCallback();
					} else if (name === 'final-step') {
						await actualCallback();
					}
				})
			};

			const workflow = googleWorkflow.prototype;
			await workflow.run.call({ env: mockEnv }, mockEvent, mockStep);

			expect(mockStep.do).toHaveBeenCalledTimes(3);
		});

		it('handles multiple attachments', async () => {
			const mockEnv = {
				MODEL: 'gemini-2.0-flash',
				GOOGLE_GEMINI_API_KEY: 'test-key',
				CF_ACCOUNT_ID: 'test-account',
				GATEWAY_NAME: 'test-gateway',
				CF_POSTURL: 'https://example.com',
				CF_ACCESS_CLIENT_ID: 'test-id',
				CF_ACCESS_CLIENT_SECRET: 'test-secret'
			};

			const mockEvent = {
				payload: {
					attachmentsData: [
						{
							filename: 'test1.pdf',
							mimeType: 'application/pdf',
							contentBase64: 'dGVzdDE='
						},
						{
							filename: 'test2.pdf',
							mimeType: 'application/pdf',
							contentBase64: 'dGVzdDI='
						}
					],
					messageId: 'test-message-id'
				}
			};

			let decodedCount = 0;
			const mockStep = {
				do: vi.fn().mockImplementation(async (name, optionsOrCallback, callback) => {
					const actualCallback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;

					if (name === 'decode-attachments') {
						const result = await actualCallback();
						decodedCount = result.length;
						return result;
					} else if (name === 'process-attachment-content') {
						await actualCallback();
					} else if (name === 'final-step') {
						await actualCallback();
					}
				})
			};

			const workflow = googleWorkflow.prototype;
			await workflow.run.call({ env: mockEnv }, mockEvent, mockStep);

			expect(decodedCount).toBe(2);
			expect(mockStep.do).toHaveBeenCalledTimes(3);
		});

		it('handles processWithGemini error and retries', async () => {
			const mockEnv = {
				MODEL: 'gemini-2.0-flash',
				GOOGLE_GEMINI_API_KEY: 'test-key',
				CF_ACCOUNT_ID: 'test-account',
				GATEWAY_NAME: 'test-gateway',
				CF_POSTURL: 'https://example.com',
				CF_ACCESS_CLIENT_ID: 'test-id',
				CF_ACCESS_CLIENT_SECRET: 'test-secret'
			};

			const mockEvent = {
				payload: {
					attachmentsData: [{
						filename: 'test.pdf',
						mimeType: 'application/pdf',
						contentBase64: 'dGVzdA=='
					}],
					messageId: 'test-message-id'
				}
			};

			let retrySetting = null;
			const mockStep = {
				do: vi.fn().mockImplementation(async (name, optionsOrCallback, callback) => {
					const actualCallback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
					const options = typeof optionsOrCallback === 'object' ? optionsOrCallback : null;

					if (name === 'decode-attachments') {
						return [{
							filename: 'test.pdf',
							content: base64ToArrayBuffer('dGVzdA=='),
							mimeType: 'application/pdf'
						}];
					} else if (name === 'process-attachment-content') {
						retrySetting = options; // リトライ設定を保存
						// actualCallbackを実行しても、エラーは発生しない
						await actualCallback();
					} else if (name === 'final-step') {
						await actualCallback();
					}
				})
			};

			const workflow = googleWorkflow.prototype;
			await workflow.run.call({ env: mockEnv }, mockEvent, mockStep);

			// process-attachment-contentステップでリトライが設定されていることを確認
			expect(retrySetting).toEqual({ retries: { limit: 1, delay: 1000 } });
			expect(mockStep.do).toHaveBeenCalledTimes(3);
		});
	});
});