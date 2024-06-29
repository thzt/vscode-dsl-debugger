"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
const dap = require("@vscode/debugadapter");
const activate = (context) => {
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('dsl', new Factory()));
};
exports.activate = activate;
class Factory {
    createDebugAdapterDescriptor(session, executable) {
        return new vscode.DebugAdapterInlineImplementation(new Session());
    }
}
class Session extends dap.LoggingDebugSession {
    constructor() {
        super('file.name');
        this.handlers = new dap.Handles();
    }
    // DAP 事件
    // 1. 初始化
    initializeRequest(response, args) {
        // debugger
        this.sendResponse(response);
        this.sendEvent(new dap.InitializedEvent());
    }
    // 2. debug 类型为 launch
    launchRequest(response, args, request) {
        // debugger
        this.sendResponse(response);
        // // 调用栈 里可以有多个调试进程
        // // 这里是将 Session.threadId 这个进程停住 stopOnEntry，不然无法停在第一行
        this.sendEvent(new dap.StoppedEvent('entry', Session.threadId));
    }
    // 3. 获取调用栈里面的进程
    threadsRequest(response, request) {
        // debugger
        response.body = {
            threads: [
                new dap.Thread(Session.threadId, 'thread 1'),
                new dap.Thread(Session.threadId + 1, 'thread 2'), // 为了表明可以有多个调试进程
            ],
        };
        this.sendResponse(response);
    }
    // 4. 获取给定进程的 调用栈帧
    stackTraceRequest(response, args, request) {
        // debugger
        response.body = {
            stackFrames: [
                new dap.StackFrame(0, // 栈帧的 id
                'frame1.name', // 栈帧的名字
                new dap.Source('readme.dsl', '/Users/thzt/project/github.com/thzt/dsl-debugger/sampleWorkspace/readme.dsl'), 1, // 第一行
                1),
                new dap.StackFrame(// 表明可以从别的文件调用过来
                1, 'frame2.name', new dap.Source('readme.dsl', '/Users/thzt/project/github.com/thzt/dsl-debugger/sampleWorkspace/caller.dsl'), 2, 1),
            ],
            totalFrames: 2,
        };
        this.sendResponse(response);
    }
    // 5. 获取给定栈帧的作用域分类
    scopesRequest(response, args, request) {
        // 不同栈帧 args.frameId 可以有不同的分类，但一般为相同的分类
        // debugger
        const localScopeReference = this.handlers.create('locals');
        const globalScopeReference = this.handlers.create('globals');
        response.body = {
            scopes: [
                new dap.Scope('Locals', localScopeReference, true),
                new dap.Scope('Globals', globalScopeReference, true),
            ],
        };
        this.sendResponse(response);
    }
    // 6. 获取不同栈帧分类的变量，这里拿不到栈帧信息，只有分类信息
    variablesRequest(response, args, request) {
        // debugger
        switch (this.handlers.get(args.variablesReference)) {
            case 'locals': {
                response.body = {
                    variables: [
                        new dap.Variable('a', '1')
                    ]
                };
                break;
            }
            case 'globals': {
                response.body = {
                    variables: [
                        new dap.Variable('b', '2')
                    ]
                };
                break;
            }
        }
        this.sendResponse(response);
    }
}
Session.threadId = 1;
//# sourceMappingURL=extension.js.map