"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const fs = require("fs");
const vscode = require("vscode");
const dap = require("@vscode/debugadapter");
const dsl_parser_1 = require("../../dsl-parser");
const dsl_interpreter_1 = require("../../dsl-interpreter");
const activate = (context) => {
    const filePath = vscode.window.activeTextEditor.document.fileName;
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('dsl', new Factory(filePath)));
};
exports.activate = activate;
class Factory {
    constructor(filePath) {
        this.filePath = filePath;
    }
    createDebugAdapterDescriptor(session, executable) {
        return new vscode.DebugAdapterInlineImplementation(new Session(this.filePath));
    }
}
class Runtime {
    constructor(filePath) {
        this.filePath = filePath;
    }
    static computeLineFromOffset(code, pos) {
        return code.slice(0, pos).split('\n').length;
    }
    start() {
        const fileContent = fs.readFileSync(this.filePath, 'utf-8');
        this.code = fileContent;
        const parser = new dsl_parser_1.Parser(this.code);
        const ast = parser.parse();
        const interpreter = new dsl_interpreter_1.Interpreter(ast);
        const generator = interpreter.eval();
        this.generator = generator;
        // 开始执行到第一个 yield
        this.interpreterEvent = this.generator.next();
        this.line = Runtime.computeLineFromOffset(this.code, this.interpreterEvent.value.pos);
    }
    getRuntimeState() {
        const { env } = this.interpreterEvent.value;
        return {
            filePath: this.filePath,
            line: this.line,
            env,
        };
    }
    stepOver() {
        while (true) {
            this.interpreterEvent = this.generator.next();
            const { done, value: { env, pos, } } = this.interpreterEvent;
            if (done) {
                debugger;
                break;
            }
            if (pos == null) {
                continue;
            }
            const line = Runtime.computeLineFromOffset(this.code, pos);
            if (line > this.line) {
                this.line = line;
                break;
            }
        }
    }
}
class Session extends dap.LoggingDebugSession {
    constructor(filePath) {
        super();
        this.filePath = filePath;
        this.handlers = new dap.Handles();
        this.runtime = new Runtime(filePath);
    }
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    // DAP 事件
    // ---- ---- ---- ---- ---- ----
    // 点击进行调试
    // 1. 初始化
    initializeRequest(response, args) {
        this.runtime.start();
        this.sendResponse(response);
        this.sendEvent(new dap.InitializedEvent());
    }
    // 2. debug 类型为 launch
    launchRequest(response, args, request) {
        // debugger;
        this.sendResponse(response);
        // // 调用栈 里可以有多个调试进程
        // // 这里是将 Session.threadId 这个进程停住 stopOnEntry，不然无法停在第一行
        this.sendEvent(new dap.StoppedEvent('entry', Session.threadId));
    }
    // 3. 获取调用栈里面的进程
    threadsRequest(response, request) {
        // debugger;
        response.body = {
            threads: [
                new dap.Thread(Session.threadId, 'thread'),
            ],
        };
        this.sendResponse(response);
    }
    // 4. 获取给定进程的 调用栈帧
    stackTraceRequest(response, args, request) {
        // debugger;
        const { filePath, line } = this.runtime.getRuntimeState();
        response.body = {
            stackFrames: [
                new dap.StackFrame(0, // 栈帧的 id
                'FrameName', // 栈帧的名字
                new dap.Source('readme.dsl', filePath), line, // 这里从 1 开始计数
                1),
            ],
            totalFrames: 1,
        };
        this.sendResponse(response);
    }
    // 5. 获取给定栈帧的作用域分类
    scopesRequest(response, args, request) {
        // 不同栈帧 args.frameId 可以有不同的分类，但一般为相同的分类
        // debugger;
        const localScopeReference = this.handlers.create('locals');
        const globalScopeReference = this.handlers.create('globals');
        response.body = {
            scopes: [
                new dap.Scope('Locals', localScopeReference, false),
                new dap.Scope('Globals', globalScopeReference, true), // expensive:true 则默认不展开（展开才获取变量 variablesRequest）
            ],
        };
        this.sendResponse(response);
    }
    // 6. 获取不同栈帧分类的变量，这里拿不到栈帧信息，只有分类信息
    variablesRequest(response, args, request) {
        const { env } = this.runtime.getRuntimeState();
        // debugger;
        switch (this.handlers.get(args.variablesReference)) {
            case 'locals': {
                const lastFrame = env[env.length - 1];
                const variables = [...lastFrame.keys()].map(prop => {
                    const value = lastFrame.get(prop);
                    return new dap.Variable(prop, value.toString());
                });
                response.body = {
                    variables,
                };
                break;
            }
            case 'globals': {
                response.body = {
                    variables: [],
                };
                break;
            }
        }
        this.sendResponse(response);
    }
    // ---- ---- ---- ---- ---- ----
    // 下一步 Stop Over
    nextRequest(response, args, request) {
        // debugger;
        this.runtime.stepOver();
        this.sendResponse(response);
        this.sendEvent(new dap.StoppedEvent('step', Session.threadId)); // 需要发送停止事件，不然不会停住
        // 会再次按顺序调用
        // 获取调试进程：threadsRequest
        // 获取栈帧：stackTraceRequest
        // 获取作用域：scopesRequest
        // 获取变量：variablesRequest
    }
}
Session.threadId = 1;
//# sourceMappingURL=extension.js.map