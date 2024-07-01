### dsl-debugger

#### 1. 调试方式

（1）本项目依次执行以下命令，VSCode 会打开另外一个窗口。
```
npm i
npm run watch
F5
```

（2）然后在窗口中，执行调试。可激活本插件业务逻辑，
```
F5
```

#### 2. 技术细节
##### 2.1 Extension 编写
（1）package.json 中添加如下字段，则可以在调试时触发 Extension 执行。并且为 Extension 注册了 `type` 为 `dsl` 的 debugger 能力（launch.json 中可以添加 `type` 为 `dsl` 的配置了），其中 `label` 必须有值。
```
"engines": {
  "vscode": "^1.66.0"
},
"activationEvents": [
  "onDebugResolve:dsl"          <---- 这里
],
"contributes": {
  "debuggers": [
    {
      "type": "dsl",            <---- 这里
      "label": "_"
    }
  ]
}
```

```
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug",
      "type": "dsl",            <---- 这里
      "request": "launch",
      "program": "${workspaceFolder}/readme.dsl",
      "stopOnEntry": true
    }
  ]
}
```

（2）Extension 激活时要注册 DebugAdapterDescriptorFactory，名字为 `dsl`，跟上面保持一致
```
export const activate = (context: vscode.ExtensionContext) => {
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory(
      'dsl',                    <---- 这里
      new Factory(),
    )
  );
};
```

（3）DebugAdapterDescriptorFactory 中会 new 一个 DebugSession，这个 `Session` 可以接收 DAP 事件
```
class Factory implements vscode.DebugAdapterDescriptorFactory {
  createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    return new vscode.DebugAdapterInlineImplementation(new Session());
  }
}
```

##### 2.2 开始调试
按 `F5` 会依次执行 `Session` 中的以下 DAP 事件，
```
class Session extends dap.LoggingDebugSession {
  public constructor() {
    super('file.name');
  }

  // DAP 事件

  // 1. 初始化
  protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {}
  // 2. debug 类型为 launch
  protected launchRequest(response: DebugProtocol.LaunchResponse, args: DebugProtocol.LaunchRequestArguments, request?: DebugProtocol.Request): void {}
  // 3. 获取调用栈里面的进程
  protected threadsRequest(response: DebugProtocol.ThreadsResponse, request?: DebugProtocol.Request): void {}
  // 4. 获取给定进程的 调用栈帧
  protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments, request?: DebugProtocol.Request): void {}
  // 5. 获取给定栈帧的作用域分类
  protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments, request?: DebugProtocol.Request): void {}
  // 6. 获取不同栈帧分类的变量，这里拿不到栈帧信息，只有分类信息
  protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request): void {}

  ...
```

##### 2.3 Step Over
Step Over 会再次触发 DAP 事件，
```
先触发：nextRequest。记得要发送一个停止事件
protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments, request?: DebugProtocol.Request): void {}

然后依次触发：
- 获取调试进程：threadsRequest
- 获取栈帧：stackTraceRequest（停在下一行是在这里设置的，获取栈帧的时候，会指定文件和行号）
- 获取作用域：scopesRequest
- 获取变量：variablesRequest
```
