import { BrowserWindow, app, ipcMain, net, protocol, session, utilityProcess } from "electron";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import { lstatSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
// native/node/files.ts
/** A failed move retains its platform code; consumers branch on reason. */
var FileMoveError = class extends Error {
	reason;
	systemCode;
	constructor(reason, systemCode) {
		super("Could not move the path without replacing the target");
		this.reason = reason;
		this.systemCode = systemCode;
		this.name = "FileMoveError";
	}
};
/** A failed file synchronization, with the platform code available for diagnostics. */
var FileSyncError = class extends Error {
	reason;
	systemCode;
	constructor(reason, systemCode) {
		super("Could not synchronize the file");
		this.reason = reason;
		this.systemCode = systemCode;
		this.name = "FileSyncError";
	}
};
function validPath(path) {
	return isAbsolute(path) && !path.includes("\0");
}
/** Bind generated native declarations to the application's stable structured errors. */
function createNativeFiles(binding) {
	return {
		async moveNoReplace(source, target) {
			if (!validPath(source) || !validPath(target)) throw new TypeError("Expected absolute paths without NUL");
			const result = await binding.moveNoReplace(source, target);
			if (result.reason) throw new FileMoveError(result.reason, result.systemCode ?? void 0);
		},
		async syncFile(path) {
			if (!validPath(path)) throw new FileSyncError("invalidArgument", void 0);
			const result = await binding.syncFile(path);
			if (result.reason) throw new FileSyncError(result.reason, result.systemCode ?? void 0);
		}
	};
}
// native/node/loader.ts
/** Loading failed before any capability was available; the original failure is retained. */
var NativeLoadError = class extends Error {
	constructor(cause) {
		super("Could not load the desktop native module", { cause });
		this.name = "NativeLoadError";
	}
};
/** Load the binding at the absolute deployment path; wrap load failures in NativeLoadError. */
function loadNative(modulePath) {
	if (!isAbsolute(modulePath)) throw new TypeError("Expected an absolute native module path");
	try {
		const binding = createRequire(import.meta.url)(modulePath);
		if (typeof binding.moveNoReplace !== "function" || typeof binding.syncFile !== "function") throw new TypeError("The native module does not provide the required capabilities");
		return { files: createNativeFiles(binding) };
	} catch (cause) {
		throw new NativeLoadError(cause);
	}
}
// src/shared/distribution.ts
/** Installer and movable-carrier identities recorded by the packager. */
var distributionKinds = [
	"zip",
	"nsis",
	"app",
	"deb",
	"rpm",
	"appimage"
];
// src/main/app/portable.ts
/** Return the prepared data directory; an absent marker selects ordinary mode. */
function portableDataDirectory(programDirectory, dataDirectoryName) {
	const marker = join(programDirectory, "kisaki-portable.txt");
	try {
		if (!lstatSync(marker).isFile()) throw new Error("The portable mode marker must be a regular file");
	} catch (cause) {
		if (cause.code === "ENOENT") return void 0;
		throw cause;
	}
	const directory = join(programDirectory, dataDirectoryName);
	if (!lstatSync(directory).isDirectory()) throw new Error("The prepared portable data directory is unavailable");
	return directory;
}
// src/main/app/paths.ts
/** Read the carrier identity that determines which portable mode is available. */
function readDistributionKind(runtimeDirectory) {
	const value = JSON.parse(readFileSync(join(runtimeDirectory, "distribution.json"), "utf8"));
	if (value && typeof value === "object" && "kind" in value) {
		for (const kind of distributionKinds) if (value.kind === kind) return kind;
	}
	throw new Error("Desktop distribution identity is unavailable");
}
/** Resolve this launch's data location; portable marker errors propagate to startup. */
function resolveDataDirectory(runtimeDirectory) {
	if (!app.isPackaged) {
		const profile = process.env.KISAKI_DEV_PROFILE;
		if (!profile || !isAbsolute(profile)) throw new Error("Start development through the desktop session with an isolated profile");
		return profile;
	}
	const kind = readDistributionKind(runtimeDirectory);
	const ordinaryDirectory = join(app.getPath("appData"), "Kisaki");
	if (process.platform === "win32") {
		if (kind === "nsis") return ordinaryDirectory;
		if (kind === "zip") return portableDataDirectory(dirname(process.execPath), "data") ?? ordinaryDirectory;
	} else if (process.platform === "darwin" && kind === "app") return portableDataDirectory(resolve(process.execPath, "../../../.."), "kisaki-portable-data") ?? ordinaryDirectory;
	else if (process.platform === "linux") {
		if (kind === "deb" || kind === "rpm") return ordinaryDirectory;
		if (kind === "appimage") {
			const appImage = process.env.APPIMAGE;
			if (!appImage || !isAbsolute(appImage)) throw new Error("The original AppImage path is unavailable");
			return portableDataDirectory(dirname(appImage), "kisaki-portable-data") ?? ordinaryDirectory;
		}
	}
	throw new Error("Unsupported desktop distribution identity");
}
/** Select the data location and set Electron paths synchronously before app.ready. */
function initializePaths() {
	const runtimeDirectory = app.isPackaged ? app.getAppPath() : resolve(dirname(fileURLToPath(import.meta.url)), "..");
	const resourceDirectory = app.isPackaged ? join(process.resourcesPath, "resources") : join(runtimeDirectory, "resources");
	const dataDirectory = resolveDataDirectory(runtimeDirectory);
	const sessionDirectory = join(dataDirectory, "browser");
	mkdirSync(dataDirectory, { recursive: true });
	mkdirSync(sessionDirectory, { recursive: true });
	app.setPath("userData", dataDirectory);
	app.setPath("sessionData", sessionDirectory);
	app.setAppLogsPath(join(dataDirectory, "logs"));
	return {
		runtimeDirectory,
		resourceDirectory,
		dataDirectory,
		nativeModulePath: join(resourceDirectory, "native", "kisaki-native.node")
	};
}
// src/main/infrastructure/log.ts
/** Write a lifecycle message for the responsible domain. */
function logLifecycle(domain, message) {
	console.info(`[${domain}] ${message}`);
}
/** Write the failure message for the operation's owner. */
function logFailure(domain, error) {
	console.error(`[${domain}] ${error instanceof Error ? error.message : "Unexpected failure"}`);
}
// src/main/app/extension-host.ts
/** Start the host through Electron's utility API, which also works with RunAsNode disabled. */
async function startExtensionHost(runtime) {
	const child = utilityProcess.fork(join(runtime, "extension-host", "entry.js"), [], {
		serviceName: "Kisaki Extension Host",
		stdio: "pipe"
	});
	let exited = false;
	const completion = new Promise((resolve) => {
		child.once("exit", () => {
			exited = true;
			resolve();
		});
	});
	try {
		await new Promise((resolve, reject) => {
			const timeout = setTimeout(() => reject(/* @__PURE__ */ new Error("Extension host did not become ready")), 1e4);
			const onExit = () => {
				clearTimeout(timeout);
				reject(/* @__PURE__ */ new Error("Extension host exited before readiness"));
			};
			child.once("exit", onExit);
			child.once("message", (message) => {
				clearTimeout(timeout);
				child.off("exit", onExit);
				if (message.type !== "ready") reject(/* @__PURE__ */ new Error("Invalid extension host readiness message"));
				else resolve();
			});
		});
	} catch (cause) {
		child.kill();
		await completion;
		throw cause;
	}
	logLifecycle("extensions", "Host ready");
	let stopping;
	return { stop() {
		stopping ??= (async () => {
			if (exited) return;
			child.postMessage({ type: "stop" });
			const timeout = setTimeout(() => {
				logFailure("extensions", /* @__PURE__ */ new Error("Host stop timed out"));
				child.kill();
			}, 5e3);
			await completion;
			clearTimeout(timeout);
			logLifecycle("extensions", "Host stopped");
		})();
		return stopping;
	} };
}
// src/main/infrastructure/windows/native-window.ts
function windowUrl(kind, rendererUrl) {
	if (!rendererUrl) return `kisaki-app://native/${kind}/index.html`;
	const base = new URL(rendererUrl);
	if (base.protocol !== "http:" || base.hostname !== "127.0.0.1") throw new Error("Development renderer must use its owned loopback server");
	return new URL(`${kind}/index.html`, base).href;
}
/** Resolve after the main frame mounts; reject on window closure or a 30-second startup timeout. */
function waitForRenderer(window) {
	return new Promise((resolveReady, reject) => {
		const timeout = setTimeout(() => {
			cleanup();
			reject(/* @__PURE__ */ new Error("Window renderer did not become ready"));
		}, 3e4);
		const onReady = (event) => {
			if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) return;
			cleanup();
			resolveReady();
		};
		const onClosed = () => {
			cleanup();
			reject(/* @__PURE__ */ new Error("Window closed before renderer readiness"));
		};
		/** Release the readiness subscriptions on either completion or failure. */
		function cleanup() {
			clearTimeout(timeout);
			ipcMain.off("window:ready", onReady);
			window.off("closed", onClosed);
		}
		ipcMain.on("window:ready", onReady);
		window.once("closed", onClosed);
	});
}
/** Open a native window and return after mounting and display; destroy it if loading fails. */
async function createNativeWindow(options) {
	const { runtime, kind, rendererUrl } = options;
	const url = windowUrl(kind, rendererUrl);
	const window = new BrowserWindow({
		title: options.title,
		width: 1120,
		height: 760,
		minWidth: 480,
		minHeight: 320,
		show: false,
		autoHideMenuBar: true,
		webPreferences: {
			preload: join(runtime, "preload", `${kind}.cjs`),
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false,
			webSecurity: true
		}
	});
	window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
	window.webContents.on("will-navigate", (event, destination) => {
		if (destination !== window.webContents.getURL()) event.preventDefault();
	});
	ipcMain.handle("window:close", (event) => {
		if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error("Window control is not available to this sender");
		window.close();
	});
	window.once("closed", () => ipcMain.removeHandler("window:close"));
	try {
		await Promise.all([waitForRenderer(window), window.loadURL(url)]);
		window.show();
		return window;
	} catch (cause) {
		if (!window.isDestroyed()) window.destroy();
		throw cause;
	}
}
// src/main/infrastructure/windows/protocol.ts
/** Register the immutable application origin before Electron becomes ready. */
function registerApplicationScheme() {
	protocol.registerSchemesAsPrivileged([{
		scheme: "kisaki-app",
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true,
			corsEnabled: true
		}
	}]);
}
/** Serve the current build's declared renderer files from the application origin. */
function serveApplicationAssets(runtime, files) {
	const root = resolve(runtime, "renderer");
	protocol.handle("kisaki-app", async (request) => {
		const url = new URL(request.url);
		if (url.hostname !== "native" || !["GET", "HEAD"].includes(request.method)) return new Response("Not found", { status: 404 });
		let pathname;
		try {
			pathname = decodeURIComponent(url.pathname);
		} catch {
			return new Response("Invalid path", { status: 400 });
		}
		const path = resolve(root, `.${pathname}`);
		const name = relative(root, path).replaceAll("\\", "/");
		if (!path.startsWith(`${root}${sep}`) || !files[`renderer/${name}`]) return new Response("Not found", { status: 404 });
		return net.fetch(pathToFileURL(path).href, { method: request.method });
	});
}
// src/main/app/bootstrap.ts
/** Load the native binding after checking its build identity, target and file digest. */
async function loadRuntime(paths) {
	const build = JSON.parse(await readFile(join(paths.runtimeDirectory, "build.json"), "utf8"));
	const target = `${{
		win32: "windows",
		darwin: "macos",
		linux: "linux"
	}[process.platform]}-${process.arch}`;
	if (build.schemaVersion !== 1 || build.buildId !== "ef338341a59494d9c795a7aac1eb8d8aa8a705b0cb8c8891435db06ac755afea" || build.target !== target) throw new Error("Desktop runtime identity does not match the current program");
	if (createHash("sha256").update(await readFile(paths.nativeModulePath)).digest("hex") !== build.files["resources/native/kisaki-native.node"]) throw new Error("Desktop native resource hash mismatch");
	loadNative(paths.nativeModulePath);
	return build;
}
/** Wait for the shared host to stop before allowing Electron's quit sequence to finish. */
function registerShutdown(host) {
	let stopped = false;
	let stopping;
	app.on("before-quit", (event) => {
		if (stopped) return;
		event.preventDefault();
		if (stopping) return;
		stopping = host.stop().then(() => {
			stopped = true;
			logLifecycle("app", "Shutdown complete");
			app.quit();
		}, (cause) => {
			logFailure("app", cause);
			app.exit(1);
		});
	});
}
/** Start the selected window and shared host, then signal readiness to the development session. */
async function bootstrap() {
	logLifecycle("app", "Starting");
	registerApplicationScheme();
	app.setName(app.isPackaged ? "Kisaki" : "Kisaki Dev");
	if (process.platform === "win32") app.setAppUserModelId(app.isPackaged ? "me.kisaki" : "me.kisaki.dev");
	if (process.platform === "linux") app.setDesktopName(app.isPackaged ? "me.kisaki.desktop" : "me.kisaki.dev.desktop");
	const paths = initializePaths();
	if (!app.requestSingleInstanceLock()) {
		app.quit();
		return;
	}
	const build = await loadRuntime(paths);
	logLifecycle("app", "Native resources loaded");
	await app.whenReady();
	logLifecycle("app", "Electron ready");
	serveApplicationAssets(paths.runtimeDirectory, build.files);
	session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
		callback(false);
	});
	session.defaultSession.setPermissionCheckHandler(() => false);
	registerShutdown(await startExtensionHost(paths.runtimeDirectory));
	const requestedKind = app.isPackaged ? "main" : process.env.KISAKI_WINDOW ?? "main";
	if (![
		"main",
		"reader",
		"player",
		"game-panel"
	].includes(requestedKind)) throw new Error("Unknown development window");
	const window = await createNativeWindow({
		runtime: paths.runtimeDirectory,
		title: app.getName(),
		kind: requestedKind,
		rendererUrl: app.isPackaged ? void 0 : process.env.KISAKI_RENDERER_URL
	});
	window.on("closed", () => app.quit());
	app.on("second-instance", () => {
		if (window.isMinimized()) window.restore();
		window.focus();
	});
	logLifecycle("app", `Ready ef338341a59494d9c795a7aac1eb8d8aa8a705b0cb8c8891435db06ac755afea`);
	if (!app.isPackaged) {
		process.on("message", (message) => {
			if (message && typeof message === "object" && "type" in message && message.type === "shutdown") app.quit();
		});
		process.on("disconnect", () => app.quit());
		process.send?.({
			type: "ready",
			buildId: "ef338341a59494d9c795a7aac1eb8d8aa8a705b0cb8c8891435db06ac755afea"
		});
	}
}
// src/main/entry.ts
bootstrap().catch((cause) => {
	logFailure("app", cause);
	app.exit(1);
});
