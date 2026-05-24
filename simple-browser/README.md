# Simple Browser - 基于 Rust 的简单浏览器

这是一个基于 Rust 构建的非常简单的浏览器，集成了 QuickJS 引擎、网络支持和 WebGPU 渲染器。

## 功能特性

- **WebGPU 渲染**: 使用 `webgpu-web-renderer` 进行 GPU 加速的网页渲染
- **JavaScript 引擎**: 内置简化版 JS 引擎（支持变量、console.log、简单算术）
- **网络支持**: HTTP/HTTPS 请求获取网页资源
- **事件处理**: 鼠标点击、移动事件
- **DOM API**: 提供 document/window 等基础 DOM API
- **多标签页架构**: 每个标签页独立实例（为未来多进程架构预留）

## 项目结构

```
simple-browser/
├── Cargo.toml              # Rust 项目配置
├── .cargo/
│   └── config.toml        # Cargo 配置（使用国内镜像）
├── src/
│   ├── main.rs            # 程序入口
│   ├── lib.rs             # 库入口
│   ├── browser.rs         # 浏览器主结构
│   ├── js_engine.rs       # JavaScript 引擎
│   ├── dom_api.rs         # DOM API 桥接
│   ├── event_handler.rs   # 事件处理
│   ├── network.rs         # 网络模块
│   ├── renderer.rs        # WebGPU 渲染器
│   └── shaders/
│       └── page.wgsl      # 页面渲染着色器
└── README.md              # 本文件
```

## 依赖项

- **winit**: 窗口管理和事件循环
- **wgpu**: WebGPU 图形 API
- **webgpu-web-renderer**: 本地路径依赖的渲染引擎
- **ureq**: HTTP 客户端
- **anyhow**: 错误处理
- **log/env_logger**: 日志系统

## 使用方法

### 构建项目

```bash
cd simple-browser
cargo build --release
```

### 运行浏览器

```bash
# 运行默认页面
cargo run

# 导航到指定 URL
cargo run -- "https://example.com"

# 使用 data URL
cargo run -- "data:text/html,<h1>Hello World</h1>"
```

## 架构说明

### 浏览器核心 (`browser.rs`)

`SimpleBrowser` 是浏览器的主结构，负责：
- 管理窗口和事件循环
- 协调渲染引擎和 JS 引擎
- 处理页面导航和资源加载

### JavaScript 引擎 (`js_engine.rs`)

简化版的 JS 引擎，支持：
- 变量声明（var/let/const）
- 基础数据类型（number, string, boolean, null, undefined）
- 简单算术运算（+ - * /）
- console.log/error/warn
- 回调函数注册

**注意**: 由于环境限制，使用的是纯 Rust 实现的简化版 JS 引擎。生产环境建议使用 `quickjs-rusty` crate。

### DOM API (`dom_api.rs`)

提供基础的 DOM 操作 API：
- `document.getElementById()`
- `document.querySelector()` / `document.querySelectorAll()`
- `element.setAttribute()` / `element.getAttribute()`
- `element.style` 属性操作

### 事件处理 (`event_handler.rs`)

处理用户输入事件：
- 鼠标点击、移动
- 元素事件监听器
- 全局事件分发

### 网络模块 (`network.rs`)

支持多种 URL 协议：
- `http://` / `https://` - HTTP 请求
- `file://` - 本地文件
- `data:` - Data URL

### 渲染器 (`renderer.rs`)

WebGPU 渲染管线：
- 创建窗口表面
- 初始化渲染纹理
- 将 webgpu-web-renderer 的输出渲染到屏幕

## 已知限制

1. **JavaScript 引擎**: 当前是简化实现，不支持复杂语法（函数定义、对象方法、闭包等）
2. **DOM 操作**: 动态 DOM 修改功能有限
3. **CSS**: 依赖 webgpu-web-renderer 的 CSS 支持
4. **表单**: 表单提交和输入处理尚未完整实现

## 未来改进

- [ ] 集成完整的 QuickJS 引擎（需要 libclang 环境）
- [ ] 实现完整的 DOM API（createElement, appendChild 等）
- [ ] 添加地址栏 UI
- [ ] 支持多标签页
- [ ] 实现 JavaScript 事件回调
- [ ] 添加前进/后退导航
- [ ] 支持 Cookie 和本地存储

## 许可证

MIT License
