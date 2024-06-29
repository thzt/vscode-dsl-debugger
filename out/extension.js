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
    }
    initializeRequest(response, args) {
        debugger;
    }
}
//# sourceMappingURL=extension.js.map