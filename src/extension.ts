import * as vscode from 'vscode';
import * as dap from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';

export const activate = (context: vscode.ExtensionContext) => {
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory(
      'dsl',
      new Factory(),
    )
  );
};

class Factory implements vscode.DebugAdapterDescriptorFactory {
  createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    return new vscode.DebugAdapterInlineImplementation(new Session());
  }
}

class Session extends dap.LoggingDebugSession {
  public constructor() {
    super('file.name');
  }

  protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
    debugger;
  }
}