/**
 * auto-push.js — 事件驱动的 reference/ 文件夹自动推送脚本
 *
 * 使用 Node.js 原生 fs.watch（Windows 底层: ReadDirectoryChangesW）
 * 仅在 reference/ 文件夹发生文件变更时才触发 git add/commit/push，
 * 无轮询，零 CPU 占用。
 *
 * 用法:
 *   node auto-push.js             前台运行
 *   node auto-push.js &           后台运行
 *   Ctrl+C 停止
 *
 * 可配置环境变量:
 *   WATCH_DIR    监控的文件夹（默认: ./reference）
 *   DEBOUNCE_MS  防抖间隔毫秒（默认: 2000）
 *   BRANCH       目标分支（默认: main）
 *   COMMIT_MSG   提交信息（默认: "auto: update reference files"）
 */

const fs = require("fs");
const path = require("path");
const { execSync, exec } = require("child_process");

// ---- 配置 ------------------------------------------------
const WATCH_DIR = process.env.WATCH_DIR || "./reference";
const DEBOUNCE_MS = parseInt(process.env.DEBOUNCE_MS, 10) || 10000;
const BRANCH = process.env.BRANCH || "main";
const COMMIT_MSG = process.env.COMMIT_MSG || "auto: update reference files";

// ---- 初始化 ----------------------------------------------
const watchPath = path.resolve(WATCH_DIR);

if (!fs.existsSync(watchPath)) {
    console.error(`[auto-push] 错误: 目录 '${watchPath}' 不存在`);
    process.exit(1);
}

console.log("============================================");
console.log(" auto-push 已启动（事件驱动模式）");
console.log(` 监控目录:   ${watchPath}`);
console.log(` 防抖间隔:   ${DEBOUNCE_MS}ms`);
console.log(` 目标分支:   ${BRANCH}`);
console.log(" 按 Ctrl+C 停止");
console.log("============================================");

// ---- 防抖逻辑 --------------------------------------------
let debounceTimer = null;
let pendingChanges = new Set(); // 记录变更的文件

function flush() {
    const changes = [...pendingChanges];
    pendingChanges.clear();

    const now = new Date().toLocaleString("zh-CN", { hour12: false });
    console.log(`\n[${now}] 检测到变更:`);
    changes.forEach((f) => console.log(`  ${path.relative(watchPath, f) || "."}`));

    try {
        execSync(`git add "${WATCH_DIR}/"`, { stdio: "inherit" });

        // 检查是否有实际变更
        const diffResult = execSync("git diff --cached --quiet", { stdio: "pipe" });
        // diff --quiet 返回 0 表示无差异
        console.log(`[${now}] 无新增变更，跳过提交`);
        return;
    } catch (e) {
        // diff --quiet 在有差异时返回非 0，进入 catch 是正常的
        if (e.status !== 1) throw e;
    }

    try {
        execSync(`git commit -m "${COMMIT_MSG}"`, { stdio: "inherit" });
        const timestamp = new Date().toLocaleString("zh-CN", { hour12: false });
        console.log(`[${timestamp}] 已提交，正在推送...`);
        execSync(`git push origin ${BRANCH}`, { stdio: "inherit" });
        console.log(`[${timestamp}] 推送完成 ✓`);
    } catch (e) {
        console.error(`[auto-push] 推送失败: ${e.message}`);
    }
}

function scheduleFlush() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flush, DEBOUNCE_MS);
}

// ---- 事件监听 --------------------------------------------
// Windows 下 fs.watch 基于 ReadDirectoryChangesW，是真正的系统事件
fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
    if (!filename) return;

    // 忽略 .git 目录和临时文件
    if (filename.startsWith(".git") || filename.endsWith("~") || filename.endsWith(".tmp")) {
        return;
    }

    const now = new Date().toLocaleString("zh-CN", { hour12: false });
    console.log(`[${now}] ${eventType}: ${filename}`);

    pendingChanges.add(path.join(watchPath, filename));
    scheduleFlush();
});

console.log("[auto-push] 监听已就绪，等待文件变更...\n");

// 优雅退出
process.on("SIGINT", () => {
    console.log("\n[auto-push] 已停止");
    process.exit(0);
});
