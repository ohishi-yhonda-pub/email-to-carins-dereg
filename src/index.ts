/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import { GenerateContentRequest, GenerateContentResult, GenerationConfig, GenerativeModel, GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

import PostalMime from 'postal-mime';
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers"
import { a } from "vitest/dist/chunks/suite.d.FvehnV49.js";
import { JsonReporter } from "vitest/reporters.js";

export default {
	async fetch(request, env, ctx): Promise<Response> {

		return new Response('Hello World!');
	},
	async email(request, env, ctx) {
		console.log("email")
		await BuildMessage(request, env)

		// return new Response('Email received successfully!', { status: 200 });
	}
} satisfies ExportedHandler<Env>;

export const BuildMessage = async (message: ForwardableEmailMessage, env: Env) => {
	const rawEmail = await streamToArrayBuffer(message.raw, message.rawSize);
	const parser = new PostalMime();
	const parsedEmail = await parser.parse(rawEmail);

	let messageId = message.headers.get('message-id');
	messageId = messageId ? messageId.replace(/^<|>$/g, '') : '';
	const attachmentsData = await processAttachments(parsedEmail.attachments, env, messageId)
	console.log(`Triggering MyWorkflow with attachment data for messageId: ${messageId}`);

	const workflowId = `email-workflow-${messageId || Date.now()}`;
	// const workflowStub = env.GOOGLE_WORKFLOW.get(env.GOOGLE_WORKFLOW.get(workflowId));
	await env.GOOGLE_WORKFLOW.createBatch([
		{
			params: {
				attachmentsData: attachmentsData,
				messageId: messageId,
			}
		}
	]);
	console.log(`Workflow ${workflowId} with json triggered.`);

}



export const processAttachments = async (attachments: any[], env: Env, messageId: string): Promise<{ filename: string; mimeType: string; contentBase64: string; }[]> => {
	if (attachments.length === 0) {
		console.log('No attachments');
		return [];
	}
	let processedAttachments: { filename: string; mimeType: string; contentBase64: string; }[] = [];

	for (const att of attachments) {
		console.log('Attachment: ', att.filename);
		console.log('Attachment disposition: ', att.disposition);
		console.log('Attachment mime type: ', att.mimeType);
		console.log('Attachment content: ', att.content);
		var formData = new FormData();
		const file = new File([att.content], att.filename, { type: att.mimeType });
		formData.append('file', file);
		await fetch(env.CF_POSTURL, {
			method: 'POST',
			body: formData,
			headers: {
				"CF-Access-Client-Id": env.CF_ACCESS_CLIENT_ID,
				"CF-Access-Client-Secret": env.CF_ACCESS_CLIENT_SECRET
			}
		});
		const contentBase64 = arrayBufferToBase64(att.content);
		processedAttachments.push({
			filename: att.filename,
			mimeType: att.mimeType,
			contentBase64: contentBase64,
		});
	}
	// return attachmentInfo;

	return processedAttachments;
}

export class googleWorkflow extends WorkflowEntrypoint<Env, { attachmentsData: { filename: string; mimeType: string; contentBase64: string; }[], messageId: string }> {
	// run() メソッドは、ワークフローがトリガーされたときに実行されます。
	async run(event: WorkflowEvent<{ attachmentsData: { filename: string; mimeType: string; contentBase64: string; }[], messageId: string }>, step: WorkflowStep) {
		// console.log(`MyWorkflow started for messageId: ${event.messageId}`);
		const { attachmentsData, messageId } = event.payload
		const env = this.env as Env;
		// 最初のステップ: 添付ファイルデータを直接取得し、Base64をデコード
		let decodedAttachments = await step.do("decode-attachments", async () => {
			const decoded: { filename: string; content: ArrayBuffer; mimeType: string; }[] = [];
			for (const att of attachmentsData) {
				console.log(`Decoding attachment: ${att.filename}`);
				const content = base64ToArrayBuffer(att.contentBase64);
				decoded.push({ filename: att.filename, content: content, mimeType: att.mimeType });
				console.log(`Decoded ${att.filename} (${content.byteLength} bytes)`);
			}
			return decoded;
		});

		// 2番目のステップ: 添付ファイルの内容を処理 (例: ログ出力、別のサービスへの転送など)
		step.do("process-attachment-content", { retries: { limit: 1, delay: 1000 } }, async () => {
			for (const att of decodedAttachments) {
				if (att.content) {
					console.log(`Processing content for ${att.filename} (MIME: ${att.mimeType})`);
					// ここで att.content は ArrayBuffer です。
					try {
						await processWithGemini(env, att);
					} catch (error) {
						console.error("Error generating content:", error);
						throw new Error("Failed to generate content from attachments.");
					}

					console.log("Generated content:JSON");

					// ここで添付ファイルの内容 (att.content) を利用して、
					// 画像処理、テキスト解析、データベースへの保存などのロジックを実装できます。
					// 例: if (att.mimeType?.startsWith('image/')) { /* 画像処理 */ }

				}
			}
			console.log("Finished processing attachment content in workflow.");
		});

		// 必要に応じて、さらにステップを追加できます。
		step.do("final-step", async () => {
			console.log("MyWorkflow completed.");
		});
	}
}
// ArrayBuffer を Base64 文字列に変換するヘルパー関数
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	let binary = '';
	const bytes = new Uint8Array(buffer);
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}
// Base64 文字列を ArrayBuffer に変換するヘルパー関数
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binary_string = atob(base64);
	const len = binary_string.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binary_string.charCodeAt(i);
	}
	return bytes.buffer;
}
export const streamToArrayBuffer = async (stream: ReadableStream<Uint8Array>, streamSize: number): Promise<Uint8Array> => {
	let result = new Uint8Array(streamSize);
	let bytesRead = 0;
	const reader = stream.getReader();
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		result.set(value, bytesRead);
		bytesRead += value.length;
	}
	return result;
};

// Geminiで処理してアップロードするヘルパー関数
export const processWithGemini = async (env: Env, attachment: { content: ArrayBuffer; filename: string; mimeType: string }): Promise<void> => {
	const generativModel = new GoogleGenerativeAI(env.GOOGLE_GEMINI_API_KEY);
	const genModel = await generativModel.getGenerativeModel(
		{ model: env.MODEL }, 
		{ baseUrl: `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.GATEWAY_NAME}/google-ai-studio` }
	);
	
	console.log("Generation config");
	const payload = {
		contents: [{
			role: "user", parts: [
				{ text: "このファイルが登録識別情報等通知書であるか確認してください。でなければ空文字列を返してください。" },
				{ text: "このファイルから有効期間の満了する日を抽出してください。有効期間満了元号、有効期間満了年、有効期間満了月、有効期間満了日で抽出してください。" },
				{ text: "このファイルから車検証の車台番号を抽出してください。" },
				{ text: "出力はjson形式で、以下のキーを含むオブジェクトを返してください。" },
				{ text: "CarId: 車検証の車台番号を抽出した結果" },
				{ text: "ValidPeriodExpirdateE:有効期間満了元号" },
				{ text: "ValidPeriodExpirdateY:有効期間満了年" },
				{ text: "ValidPeriodExpirdateM:有効期間満了月" },
				{ text: "ValidPeriodExpirdateD:有効期間満了日" },
				{ text: "IsValidPeriodExpirdate: 有効期間満了日が抽出できたかどうか" },
				{ text: "IsCarId: 車検証の車台番号が抽出できたかどうか" },
				{ inlineData: { mimeType: attachment.mimeType, data: arrayBufferToBase64(attachment.content) } }
			]
		}],
		generationConfig: {
			responseMimeType: "application/json",
			responseSchema: {
				type: SchemaType.OBJECT,
				properties: {
					CarId: { type: SchemaType.STRING },
					ValidPeriodExpirdateE: { type: SchemaType.STRING },
					ValidPeriodExpirdateY: { type: SchemaType.STRING },
					ValidPeriodExpirdateM: { type: SchemaType.STRING },
					ValidPeriodExpirdateD: { type: SchemaType.STRING },
					IsValidPeriodExpirdate: { type: SchemaType.BOOLEAN },
					IsCarId: { type: SchemaType.BOOLEAN }
				}
			}
		} as GenerationConfig
	};
	
	console.log(`Sending payload to Gemini API`, JSON.stringify(payload));
	console.log("Parts to generate content");
	
	const generatedContent = await genModel.generateContent({ 
		contents: payload.contents, 
		generationConfig: payload.generationConfig as GenerationConfig 
	});
	
	const resultText = generatedContent?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
	if (resultText) {
		const uuid = crypto.randomUUID();
		// 両方の処理を並行実行することも可能だが、順次実行の方が安全
		await uploadFileWithUuid(env, attachment.content, attachment.filename, attachment.mimeType, uuid);
		await postGeminiResult(env, resultText, uuid);
	}
};

// ファイルをアップロードするヘルパー関数
export const uploadFileWithUuid = async (env: Env, fileContent: ArrayBuffer, filename: string, mimeType: string, uuid: string): Promise<void> => {
	const multiform = new FormData();
	multiform.append("uuid", uuid);
	multiform.append("file", new File([new Uint8Array(fileContent)], filename, { type: mimeType }));
	const response = await fetch(env.CF_POSTURL, {
		method: 'POST',
		body: multiform,
		headers: {
			"Content-Type": "multipart/form-data",
			"CF-Access-Client-Id": env.CF_ACCESS_CLIENT_ID,
			"CF-Access-Client-Secret": env.CF_ACCESS_CLIENT_SECRET
		}
	});
	if (!response.ok) {
		console.error("Failed to upload file:", response.status, response.statusText);
		throw new Error(`Failed to upload file: ${response.status} ${response.statusText}`);
	}
};

// Gemini の結果を POST するヘルパー関数
export const postGeminiResult = async (env: Env, resultText: string, uuid: string): Promise<void> => {
	const postRes = await fetch(env.CF_POSTURL, {
		method: 'POST',
		body: JSON.stringify({ ...JSON.parse(resultText), type: "ValidPeriodExpirdateE", fileUuid: uuid }),
		headers: {
			"Content-Type": "application/json",
			"CF-Access-Client-Id": env.CF_ACCESS_CLIENT_ID,
			"CF-Access-Client-Secret": env.CF_ACCESS_CLIENT_SECRET
		}
	});
	if (!postRes.ok) {
		console.error("Failed to post result:", postRes.status, postRes.statusText, await postRes.text());
		throw new Error(`Failed to post result: ${postRes.status} ${postRes.statusText}`);
	}
	console.log("Posted Gemini result:", resultText);
};


