# Email to Car Inspection Deregistration

[![Test and Upload Coverage](https://github.com/ohishi-yhonda-org/email-to-carins-dereg/actions/workflows/test-and-coverage.yml/badge.svg)](https://github.com/ohishi-yhonda-org/email-to-carins-dereg/actions/workflows/test-and-coverage.yml)

Cloudflare Workersアプリケーション - メールから車検証明書の登録解除を処理

## 概要

このプロジェクトは、メールで受信した車検証明書の画像をGoogle Gemini APIで処理し、車両情報を抽出してAPIに送信するCloudflare Workersアプリケーションです。

## 機能

- メールの受信と添付ファイルの処理
- Google Gemini APIを使用した画像からのテキスト抽出
- 車両情報（車両番号、有効期限など）の自動抽出
- 抽出したデータのAPI送信
- Cloudflare Workflowsを使用した非同期処理

## テスト

```bash
# 通常のテスト
npm test

# カバレッジ付きテスト
npm run test:coverage

# クリーンな出力（Windows）
npm run test:clean
```

## カバレッジレポート

最新のカバレッジレポートは[パブリックリポジトリ](https://github.com/ohishi-yhonda-pub/email-to-carins-dereg/tree/coverage)で確認できます。

## セキュリティ

- `.dev.vars`と`.env`ファイルはgit-cryptで暗号化されています
- 機密情報は環境変数で管理されています

## 必要な環境変数

- `GOOGLE_GEMINI_API_KEY` - Google Gemini APIキー
- `CF_POSTURL` - データ送信先のURL
- `CF_ACCESS_CLIENT_ID` - Cloudflare Accessクライアント ID
- `CF_ACCESS_CLIENT_SECRET` - Cloudflare Accessクライアントシークレット
- `CF_ACCOUNT_ID` - CloudflareアカウントID
- `GATEWAY_NAME` - AI Gatewayの名前