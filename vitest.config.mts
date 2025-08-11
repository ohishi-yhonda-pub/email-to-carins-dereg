import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		setupFiles: ['./test/setup.ts'], // セットアップファイルを追加
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
				isolatedStorage: false, // ワークフローのため無効化
				singleWorker: true, // 単一ワーカーを使用
				miniflare: {
					// すべての永続化を無効化
					kvPersist: false,
					durableObjectsPersist: false,
					cachePersist: false,
					r2Persist: false,
					workflowsPersist: false,
					// メモリストレージのみ使用
					unsafeEphemeralDurableObjects: true,
					// ファイルシステムベースの一時ファイルを無効化
					unsafeFileSystemPersistence: false,
				},
			},
		},
		// テストのタイムアウトを設定
		testTimeout: 30000,
		// フックのタイムアウトを設定
		hookTimeout: 10000,
		coverage: {
			provider: 'istanbul',
			reporter: ['text', 'json', 'html'],
			reportsDirectory: './coverage',
			exclude: [
				'node_modules/',
				'test/',
				'**/*.d.ts',
				'**/*.config.*',
				'**/*.spec.*',
				'**/*.test.*',
				'test-clean.js',
				'test-quiet.ps1',
				'.wrangler/**',
				'.wrangler/**/*'
			]
		},
		fileParallelism: false,
		// 最大並行数を1に制限
		maxConcurrency: 1,
		// プールのクリーンアップを明示的に設定
		teardownTimeout: 5000,
		// Windowsでのファイルロック問題を回避
		// ...(process.platform === 'win32' && {
		// 	// ファイル監視を無効化
		// 	watch: false,
		// 	// リポーターをシンプルに
		// 	reporters: ['basic'],
		// }),
	},
});
