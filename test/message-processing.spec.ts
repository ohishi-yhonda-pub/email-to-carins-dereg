
/// <reference types="../worker-configuration" />

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import main, { BuildMessage, processAttachments } from '../src/index';
import PostalMime from 'postal-mime';

// PostalMime をモック
vi.mock('postal-mime', () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			parse: vi.fn()
		}))
	};
});

describe('Message Processing Tests', () => {
	let originalFetch: typeof globalThis.fetch;
	let originalCrypto: typeof globalThis.crypto;

	beforeEach(() => {
		vi.clearAllMocks();
		originalFetch = globalThis.fetch;
		originalCrypto = globalThis.crypto;

		vi.spyOn(console, 'log').mockImplementation(() => { });
		vi.spyOn(console, 'error').mockImplementation(() => { });

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

	describe('main handler', () => {
		it('handles fetch request', async () => {
			const env = {
				MODEL: 'gemini-2.0-flash',
				ENV_MODEL: '@cf/baai/bge-m3',
				CF_POSTURL: '',
				CF_ACCESS_CLIENT_ID: '',
				CF_ACCESS_CLIENT_SECRET: '',
				GOOGLE_GEMINI_API_KEY: '',
				WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB: '',
				CF_ACCOUNT_ID: '',
				GATEWAY_NAME: '',
				GOOGLE_WORKFLOW: {} as Workflow
			} as Env;
			const ctx = {} as ExecutionContext;

			// main.fetch は request を使用しないので、null でも問題ない
			const response = await main.fetch(null as any, env, ctx);

			expect(response).toBeInstanceOf(Response);
			expect(response.status).toBe(200);
			expect(await response.text()).toBe('Hello World!');
		});

		it('handles email request', async () => {
			const mockMessage = {
				headers: new Map([['message-id', '<test-message-id>']]),
				raw: new ReadableStream({
					start(controller) {
						controller.enqueue(new Uint8Array([1, 2, 3]));
						controller.close();
					}
				}),
				rawSize: 3,
				from: 'test@example.com',
				to: 'recipient@example.com',
				setReject: vi.fn(),
				forward: vi.fn(),
				reply: vi.fn()
			} as unknown as ForwardableEmailMessage;

			const mockEnv = {
				MODEL: 'gemini-2.0-flash',
				ENV_MODEL: '@cf/baai/bge-m3',
				CF_POSTURL: '',
				CF_ACCESS_CLIENT_ID: '',
				CF_ACCESS_CLIENT_SECRET: '',
				GOOGLE_GEMINI_API_KEY: '',
				WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB: '',
				CF_ACCOUNT_ID: '',
				GATEWAY_NAME: '',
				GOOGLE_WORKFLOW: {
					createBatch: vi.fn().mockResolvedValue(undefined)
				} as any
			} as Env;

			const ctx = {} as ExecutionContext;

			// PostalMime のモックを設定
			(PostalMime as any).mockImplementation(() => ({
				parse: vi.fn().mockResolvedValue({
					attachments: []
				})
			}));

			await main.email(mockMessage, mockEnv, ctx);

			expect(mockEnv.GOOGLE_WORKFLOW.createBatch).toHaveBeenCalled();
		});
	});

	describe('BuildMessage', () => {
		it('processes message with attachments', async () => {
			const mockMessage = {
				headers: new Map([['message-id', '<test-message-id>']]),
				raw: new ReadableStream({
					start(controller) {
						controller.enqueue(new Uint8Array([1, 2, 3]));
						controller.close();
					}
				}),
				rawSize: 3,
				from: 'test@example.com',
				to: 'recipient@example.com',
				setReject: vi.fn(),
				forward: vi.fn(),
				reply: vi.fn()
			} as unknown as ForwardableEmailMessage;

			const mockEnv = {
				MODEL: 'gemini-2.0-flash',
				ENV_MODEL: '@cf/baai/bge-m3',
				CF_POSTURL: 'https://example.com',
				CF_ACCESS_CLIENT_ID: 'test-id',
				CF_ACCESS_CLIENT_SECRET: 'test-secret',
				GOOGLE_GEMINI_API_KEY: '',
				WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB: '',
				CF_ACCOUNT_ID: '',
				GATEWAY_NAME: '',
				GOOGLE_WORKFLOW: {
					createBatch: vi.fn().mockResolvedValue(undefined)
				} as any
			} as Env;

			// PostalMime のモックを設定
			(PostalMime as any).mockImplementation(() => ({
				parse: vi.fn().mockResolvedValue({
					attachments: [{
						filename: 'test.pdf',
						mimeType: 'application/pdf',
						content: new Uint8Array([1, 2, 3]),
						disposition: 'attachment'
					}]
				})
			}));

			await BuildMessage(mockMessage, mockEnv);

			expect(mockEnv.GOOGLE_WORKFLOW.createBatch).toHaveBeenCalledWith([{
				params: {
					attachmentsData: [{
						filename: 'test.pdf',
						mimeType: 'application/pdf',
						contentBase64: expect.any(String)
					}],
					messageId: 'test-message-id'
				}
			}]);
		});

		it('uses Date.now() when messageId is empty', async () => {
			const mockMessage = {
				headers: new Map([['message-id', '']]), // 空のmessage-id
				raw: new ReadableStream({
					start(controller) {
						controller.enqueue(new Uint8Array([1, 2, 3]));
						controller.close();
					}
				}),
				rawSize: 3,
				from: 'test@example.com',
				to: 'recipient@example.com',
				setReject: vi.fn(),
				forward: vi.fn(),
				reply: vi.fn()
			} as unknown as ForwardableEmailMessage;

			const mockEnv = {
				MODEL: 'gemini-2.0-flash',
				ENV_MODEL: '@cf/baai/bge-m3',
				CF_POSTURL: '',
				CF_ACCESS_CLIENT_ID: '',
				CF_ACCESS_CLIENT_SECRET: '',
				GOOGLE_GEMINI_API_KEY: '',
				WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB: '',
				CF_ACCOUNT_ID: '',
				GATEWAY_NAME: '',
				GOOGLE_WORKFLOW: {
					createBatch: vi.fn().mockResolvedValue(undefined)
				} as any
			} as Env;

			// PostalMime のモックを設定
			(PostalMime as any).mockImplementation(() => ({
				parse: vi.fn().mockResolvedValue({
					attachments: []
				})
			}));

			// Date.now() をモック
			const originalDateNow = Date.now;
			Date.now = vi.fn().mockReturnValue(1234567890);

			await BuildMessage(mockMessage, mockEnv);

			expect(mockEnv.GOOGLE_WORKFLOW.createBatch).toHaveBeenCalledWith([{
				params: {
					attachmentsData: [],
					messageId: ''
				}
			}]);

			// Date.now() が使用されたことを確認
			expect(Date.now).toHaveBeenCalled();

			Date.now = originalDateNow;
		});

		it('handles message without message-id header', async () => {
			const mockMessage = {
				headers: new Map(), // message-idヘッダーなし
				raw: new ReadableStream({
					start(controller) {
						controller.enqueue(new Uint8Array([1, 2, 3]));
						controller.close();
					}
				}),
				rawSize: 3,
				from: 'test@example.com',
				to: 'recipient@example.com',
				setReject: vi.fn(),
				forward: vi.fn(),
				reply: vi.fn()
			} as unknown as ForwardableEmailMessage;

			const mockEnv = {
				MODEL: 'gemini-2.0-flash',
				ENV_MODEL: '@cf/baai/bge-m3',
				CF_POSTURL: '',
				CF_ACCESS_CLIENT_ID: '',
				CF_ACCESS_CLIENT_SECRET: '',
				GOOGLE_GEMINI_API_KEY: '',
				WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB: '',
				CF_ACCOUNT_ID: '',
				GATEWAY_NAME: '',
				GOOGLE_WORKFLOW: {
					createBatch: vi.fn().mockResolvedValue(undefined)
				} as any
			} as Env;

			// PostalMime のモックを設定
			(PostalMime as any).mockImplementation(() => ({
				parse: vi.fn().mockResolvedValue({
					attachments: []
				})
			}));

			await BuildMessage(mockMessage, mockEnv);

			expect(mockEnv.GOOGLE_WORKFLOW.createBatch).toHaveBeenCalledWith([{
				params: {
					attachmentsData: [],
					messageId: ''
				}
			}]);
		});
	});

	describe('processAttachments', () => {
		it('returns empty array when no attachments', async () => {
			const mockEnv = {
				MODEL: 'gemini-2.0-flash',
				ENV_MODEL: '@cf/baai/bge-m3',
				CF_POSTURL: '',
				CF_ACCESS_CLIENT_ID: '',
				CF_ACCESS_CLIENT_SECRET: '',
				GOOGLE_GEMINI_API_KEY: '',
				WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB: '',
				CF_ACCOUNT_ID: '',
				GATEWAY_NAME: '',
				GOOGLE_WORKFLOW: {} as Workflow
			} as Env;
			const result = await processAttachments([], mockEnv, 'test-message-id');

			expect(result).toEqual([]);
		});

		it('processes single attachment', async () => {
			const mockEnv = {
				MODEL: 'gemini-2.0-flash',
				ENV_MODEL: '@cf/baai/bge-m3',
				CF_POSTURL: 'https://example.com',
				CF_ACCESS_CLIENT_ID: 'test-id',
				CF_ACCESS_CLIENT_SECRET: 'test-secret',
				GOOGLE_GEMINI_API_KEY: '',
				WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB: '',
				CF_ACCOUNT_ID: '',
				GATEWAY_NAME: '',
				GOOGLE_WORKFLOW: {} as Workflow
			} as Env;

			const attachments = [{
				filename: 'test.pdf',
				mimeType: 'application/pdf',
				content: new Uint8Array([1, 2, 3]),
				disposition: 'attachment'
			}];

			const result = await processAttachments(attachments, mockEnv, 'test-message-id');

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				filename: 'test.pdf',
				mimeType: 'application/pdf',
				contentBase64: expect.any(String)
			});

			expect(globalThis.fetch).toHaveBeenCalledWith(
				mockEnv.CF_POSTURL,
				expect.objectContaining({
					method: 'POST',
					headers: {
						"CF-Access-Client-Id": mockEnv.CF_ACCESS_CLIENT_ID,
						"CF-Access-Client-Secret": mockEnv.CF_ACCESS_CLIENT_SECRET
					}
				})
			);
		});

		it('processes multiple attachments', async () => {
			const mockEnv = {
				MODEL: 'gemini-2.0-flash',
				ENV_MODEL: '@cf/baai/bge-m3',
				CF_POSTURL: 'https://example.com',
				CF_ACCESS_CLIENT_ID: 'test-id',
				CF_ACCESS_CLIENT_SECRET: 'test-secret',
				GOOGLE_GEMINI_API_KEY: '',
				WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB: '',
				CF_ACCOUNT_ID: '',
				GATEWAY_NAME: '',
				GOOGLE_WORKFLOW: {} as Workflow
			} as Env;

			const attachments = [
				{
					filename: 'test1.pdf',
					mimeType: 'application/pdf',
					content: new Uint8Array([1, 2, 3]),
					disposition: 'attachment'
				},
				{
					filename: 'test2.pdf',
					mimeType: 'application/pdf',
					content: new Uint8Array([4, 5, 6]),
					disposition: 'attachment'
				}
			];

			const result = await processAttachments(attachments, mockEnv, 'test-message-id');

			expect(result).toHaveLength(2);
			expect(result[0].filename).toBe('test1.pdf');
			expect(result[1].filename).toBe('test2.pdf');

			// 各添付ファイルごとにfetchが呼ばれることを確認
			expect(globalThis.fetch).toHaveBeenCalledTimes(2);
		});

		it('handles attachment upload failure', async () => {
			const mockEnv = {
				MODEL: 'gemini-2.0-flash',
				ENV_MODEL: '@cf/baai/bge-m3',
				CF_POSTURL: 'https://example.com',
				CF_ACCESS_CLIENT_ID: 'test-id',
				CF_ACCESS_CLIENT_SECRET: 'test-secret',
				GOOGLE_GEMINI_API_KEY: '',
				WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB: '',
				CF_ACCOUNT_ID: '',
				GATEWAY_NAME: '',
				GOOGLE_WORKFLOW: {} as Workflow
			} as Env;

			// fetchをエラーレスポンスを返すようにモック
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error'
			});

			const attachments = [{
				filename: 'test.pdf',
				mimeType: 'application/pdf',
				content: new Uint8Array([1, 2, 3]),
				disposition: 'attachment'
			}];

			// エラーは投げられないが、アップロードは試行される
			const result = await processAttachments(attachments, mockEnv, 'test-message-id');

			expect(result).toHaveLength(1);
			expect(globalThis.fetch).toHaveBeenCalled();
		});
	});
});