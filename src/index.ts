import { libcurl } from "../out/libcurl_full.mjs";

import type {
	ProxyTransport,
	RawHeaders,
	TransferrableResponse,
} from "@mercuryworkshop/proxy-transports";

export type LibcurlImpersonateClientOptions = {
	wisp: string;
	websocket?: string;
	proxy?: string;
	transport?: string;
	connections?: Array<number>;
};

export class LibcurlImpersonateClient implements ProxyTransport {
	session: any;
	wisp: string;
	proxy?: string;
	transport?: string;
	connections?: Array<number>;
	ready = false;

	constructor(options: LibcurlImpersonateClientOptions) {
		this.wisp = options.wisp ?? options.websocket!;
		this.transport = options.transport;
		this.proxy = options.proxy;
		this.connections = options.connections;

		if (!this.wisp.endsWith("/")) {
			throw new TypeError(
				"The Websocket URL must end with a trailing forward slash.",
			);
		}
		if (!this.wisp.startsWith("ws://") && !this.wisp.startsWith("wss://")) {
			throw new TypeError(
				"The Websocket URL must use the ws:// or wss:// protocols.",
			);
		}
		if (typeof options.proxy === "string") {
			const protocol = new URL(options.proxy).protocol;
			if (!["socks5h:", "socks4a:", "http:"].includes(protocol)) {
				throw new TypeError(
					"Only socks5h, socks4a, and http proxies are supported.",
				);
			}
		}
	}

	async init(): Promise<void> {
		if (this.transport) libcurl.transport = this.transport;
		if (!libcurl.ready) {
			await libcurl.load_wasm(undefined);
			console.log(
				"Loaded libcurl-impersonate v" + libcurl.version.lib,
			);
			this.ready = true;
		}
		libcurl.set_websocket(this.wisp);
		this.session = new libcurl.HTTPSession({ proxy: this.proxy });
		if (this.connections) this.session.set_connections(...this.connections);
		this.ready = libcurl.ready;
		if (this.ready) {
			console.log(
				"Running libcurl-impersonate v" + libcurl.version.lib,
			);
		}
	}

	async meta(): Promise<void> {}

	async request(
		remote: URL,
		method: string,
		body: BodyInit | null,
		headers: RawHeaders,
		signal: AbortSignal | undefined,
	): Promise<TransferrableResponse> {
		const CHROME_ORDER = [
			"sec-ch-ua",
			"sec-ch-ua-mobile",
			"sec-ch-ua-platform",
			"upgrade-insecure-requests",
			"user-agent",
			"accept",
			"sec-fetch-site",
			"sec-fetch-mode",
			"sec-fetch-user",
			"sec-fetch-dest",
			"accept-encoding", 
			"accept-language", 
			"priority",
		] as const;

		const ALWAYS_INJECT: Record<string, string> = {
			"accept-encoding": "gzip, deflate, br, zstd",
			priority: "u=0, i",
		};

		const FALLBACK_INJECT: Record<string, string> = {
			"accept-language": "en-US,en;q=0.9",
		};

		// TODO: Right now it's always imitaitng Chrome 129, but it should be dynamic based off of the UA
		// However I can't find a good browser fingerprint database (that isn't $99/mo)
		// https://open.spotify.com/album/1SLHvtzblS30JZW9anryTE
		const CHROME_129_UA_OVERRIDE: Record<string, string> = {
			"user-agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
			"sec-ch-ua":
				'"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
			"sec-ch-ua-mobile": "?0",
			"sec-ch-ua-platform": '"Windows"',
		};

		const lowerMap = new Map<string, readonly [string, string]>();
		for (const entry of headers) {
			lowerMap.set(entry[0].toLowerCase(), entry);
		}

		const headersObj: Record<string, string> = {};
		for (const name of CHROME_ORDER) {
			if (name in CHROME_129_UA_OVERRIDE) {
				headersObj[name] = CHROME_129_UA_OVERRIDE[name];
			} else if (name in ALWAYS_INJECT) {
				headersObj[name] = ALWAYS_INJECT[name];
			} else {
				const entry = lowerMap.get(name);
				if (entry) {
					headersObj[entry[0]] = entry[1];
				} else if (name in FALLBACK_INJECT) {
					headersObj[name] = FALLBACK_INJECT[name];
				}
			}
		}

		for (const [key, value] of headers) {
			if (!CHROME_ORDER.includes(key.toLowerCase() as any)) {
				headersObj[key] = value;
			}
		}

		const payload = await this.session.fetch(remote.href, {
			method,
			headers: headersObj,
			body,
			redirect: "manual",
			signal,
		});

		return {
			body: payload.body,
			headers: payload.raw_headers,
			status: payload.status,
			statusText: payload.statusText,
		};
	}

	connect(
		url: URL,
		protocols: string[],
		requestHeaders: RawHeaders,
		onopen: (protocol: string, extensions: string) => void,
		onmessage: (data: Blob | ArrayBuffer | string) => void,
		onclose: (code: number, reason: string) => void,
		onerror: (error: string) => void,
	): [
		(data: Blob | ArrayBuffer | string) => void,
		(code: number, reason: string) => void,
	] {
		const headersObj: Record<string, string> = {};
		for (const [key, value] of requestHeaders) {
			headersObj[key] = value;
		}
		const socket = new libcurl.WebSocket(url.toString(), protocols, {
			headers: headersObj,
		}) as any;
		socket.binaryType = "arraybuffer";
		socket.onopen = () => onopen("", "");
		socket.onclose = (event: any) => onclose(event.code, event.reason);
		socket.onerror = () => onerror("");
		socket.onmessage = (event: any) => onmessage(event.data);
		return [
			(data) => socket.send(data),
			(code, reason) => socket.close(code, reason),
		];
	}
}

export default LibcurlImpersonateClient;
