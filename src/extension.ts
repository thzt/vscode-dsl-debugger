import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as dap from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';

import { Parser } from '../../dsl-parser';
import { Interpreter } from '../../dsl-interpreter';

export const activate = (context: vscode.ExtensionContext) => {
  const filePath = vscode.window.activeTextEditor.document.fileName;

  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory(
      'dsl',
      new Factory(filePath),
    )
  );
};

class Factory implements vscode.DebugAdapterDescriptorFactory {
  constructor(private filePath: string) { }

  createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    return new vscode.DebugAdapterInlineImplementation(new Session(this.filePath));
  }
}

class Runtime {
  private code: string;
  private generator: any;
  private line: number; // 从 1 开始
  private interpreterEvent: any;

  constructor(private filePath: string) { }

  private static computeLineFromOffset(code, pos) {
    return code.slice(0, pos).split('\n').length;
  }

  public start() {
    const fileContent = fs.readFileSync(this.filePath, 'utf-8');
    this.code = fileContent;

    const parser = new Parser(this.code);
    const ast = parser.parse();

    const interpreter = new Interpreter(ast);
    const generator = interpreter.eval();

    this.generator = generator;

    // 开始执行到第一个 yield
    this.interpreterEvent = this.generator.next();
    this.line = Runtime.computeLineFromOffset(this.code, this.interpreterEvent.value.pos);
  }

  public getRuntimeState() {
    const { env } = this.interpreterEvent.value;

    return {
      filePath: this.filePath,
      line: this.line,
      env,
    };
  }

  public stepOver() {
    while (true) {
      this.interpreterEvent = this.generator.next();
      const {
        done,
        value: {
          env,
          pos,
        }
      } = this.interpreterEvent;
      if (done) {
        debugger
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
  private static threadId = 1;
  private runtime: any;
  private handlers = new dap.Handles<'locals' | 'globals'>();

  public constructor(private filePath: string) {
    super();

    this.runtime = new Runtime(filePath);
  }

  // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
  // DAP 事件

  // ---- ---- ---- ---- ---- ----
  // 点击进行调试

  // 1. 初始化
  protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
    this.runtime.start();
    this.sendResponse(response);
    this.sendEvent(new dap.InitializedEvent());
  }
  // 2. debug 类型为 launch
  protected launchRequest(response: DebugProtocol.LaunchResponse, args: DebugProtocol.LaunchRequestArguments, request?: DebugProtocol.Request): void {
    // debugger;
    this.sendResponse(response);

    // // 调用栈 里可以有多个调试进程
    // // 这里是将 Session.threadId 这个进程停住 stopOnEntry，不然无法停在第一行
    this.sendEvent(new dap.StoppedEvent('entry', Session.threadId));
  }
  // 3. 获取调用栈里面的进程
  protected threadsRequest(response: DebugProtocol.ThreadsResponse, request?: DebugProtocol.Request): void {
    // debugger;
    response.body = {
      threads: [
        new dap.Thread(Session.threadId, 'thread'),
      ],
    };
    this.sendResponse(response);
  }
  // 4. 获取给定进程的 调用栈帧
  protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments, request?: DebugProtocol.Request): void {
    // debugger;
    const { filePath, line } = this.runtime.getRuntimeState();

    response.body = {
      stackFrames: [
        new dap.StackFrame(
          0,  // 栈帧的 id
          'FrameName',  // 栈帧的名字
          new dap.Source(
            'readme.dsl',
            filePath,
          ),
          line,  // 这里从 1 开始计数
          1,  // 第一列
        ),
      ],
      totalFrames: 1,
    };
    this.sendResponse(response);
  }
  // 5. 获取给定栈帧的作用域分类
  protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments, request?: DebugProtocol.Request): void {
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
  protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request): void {
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
        }
        break;
      }
      case 'globals': {
        response.body = {
          variables: [],
        }
        break;
      }
    }
    this.sendResponse(response);
  }

  // ---- ---- ---- ---- ---- ----
  // 下一步 Stop Over

  protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments, request?: DebugProtocol.Request): void {
    // debugger;
    this.runtime.stepOver();
    this.sendResponse(response);
    this.sendEvent(new dap.StoppedEvent('step', Session.threadId));  // 需要发送停止事件，不然不会停住

    // 会再次按顺序调用
    // 获取调试进程：threadsRequest
    // 获取栈帧：stackTraceRequest
    // 获取作用域：scopesRequest
    // 获取变量：variablesRequest
  }
}
