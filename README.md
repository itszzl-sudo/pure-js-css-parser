# JSCSS - Pure JavaScript HTML/CSS Parser & Layout Engine

纯JavaScript实现的HTML/CSS解析器和布局引擎，无需浏览器即可解析HTML、应用CSS样式并计算布局信息。

## 🚀 2026年5月升级！A级别标准已达成 + 装饰模块！

本项目已从B/C级别升级到**100% A级别CSS布局标准**！完成了全面的功能升级，包括选择器系统、!important优先级、align-content完整实现、grid auto-fill/auto-fit算法等。**新增装饰模块**，支持完整的CSS装饰属性解析！

## 功能特性

### 核心功能
- **HTML解析**: 将HTML字符串解析为DOM树结构
- **CSS解析**: 解析CSS样式表并匹配到对应元素
- **布局计算**: 计算每个元素的精确位置和尺寸 (x, y, width, height)
- **装饰解析**: 解析并处理CSS装饰属性（颜色、阴影、边框、背景等）
- **节点标识**: 为每个HTML节点添加 `jscssid` 属性用于唯一标识
- **布局存储**: 将计算后的布局信息存储在 `jscsslayout` 属性中
- **装饰存储**: 将解析后的装饰信息存储在 `jscssdecorations` 属性中
- **Web API**: 提供HTTP API接口供外部调用

### 支持的CSS布局特性
#### 盒模型 (Box Model)
- margin, padding, border, content-box, border-box
- min-width, max-width, min-height, max-height
- aspect-ratio, margin折叠, BFC (块级格式化上下文)

#### 显示模式 (Display Modes)
- block, inline, inline-block, none
- flex, grid, table-*, column

#### 定位系统
- static, relative, absolute, fixed, sticky
- top/right/bottom/left, inset
- z-index

#### Flexbox完整支持
- flex-direction (row, column, row-reverse, column-reverse)
- flex-wrap, justify-content (所有值)
- align-items, align-content (所有值：flex-start, flex-end, center, space-between, space-around, space-evenly, stretch)
- align-self, flex-grow, flex-shrink, flex-basis
- order, gap, row-gap, column-gap

#### Grid高级布局
- grid-template-columns, grid-template-rows
- fr分数单位, minmax()函数, repeat()函数
- auto-fill, auto-fit (智能轨道填充)
- grid-column, grid-row, grid-area
- grid-auto-flow, grid-auto-columns, grid-auto-rows
- gap, row-gap, column-gap

#### 表格布局
- table, thead, tbody, tfoot, tr, td, th, caption
- colspan, rowspan, border-collapse, border-spacing, caption-side, table-layout
- vertical-align

#### 浮动与清除
- float, clear, 包含浮动, 清除浮动

#### 选择器系统 (完整支持！)
- 标签选择器、类选择器、ID选择器
- **后代选择器** `div p`
- **子选择器** `div > p`
- **相邻兄弟选择器** `div + p`
- **通用兄弟选择器** `div ~ p`
- **属性选择器** `[attr]`, `[attr="value"]`, `[attr~="value"]`, `[attr|="value"]`, `[attr^="value"]`, `[attr$="value"]`, `[attr*="value"]`
- 通用选择器 `*`
- 多类名选择器

#### 文本与字体
- font-size, line-height, text-align, vertical-align
- text-overflow, overflow-wrap, white-space

#### 多列布局
- column-count, column-width, column-gap, column-rule
- column-span, column-fill

#### 响应式与变量
- CSS变量 (Custom Properties) --variable, var()
- @媒体查询 @media
- vw, vh, vmin, vmax, ch, ex 响应式单位

#### 计算函数
- calc(), min(), max()
- fit-content(), min-content, max-content

#### 逻辑属性与书写模式
- margin-inline, padding-block, inset-inline, inset-block
- writing-mode (horizontal-tb, vertical-rl, vertical-lr)
- direction (ltr, rtl)

#### 视觉效果与变换
- opacity, transform (完整支持！)
- **translate**: translate(), translateX(), translateY(), translateZ(), translate3d()
- **scale**: scale(), scaleX(), scaleY(), scaleZ(), scale3d()
- **rotate**: rotate(), rotateX(), rotateY(), rotateZ(), rotate3d()
- **skew**: skew(), skewX(), skewY()
- **matrix**: matrix(), matrix3d()
- **perspective**: perspective()
- **角度单位**: deg, rad, grad, turn
- **transform-origin**: 支持3D变换原点

#### CSS级联与优先级
- 选择器特异性计算
- !important 优先级支持
- 属性继承
- 内联样式、外部样式优先级

#### Overflow与裁剪
- overflow, overflow-x, overflow-y
- text-overflow (clip, ellipsis)
- hidden, scroll, auto

### 支持的CSS装饰特性 (decorator.js)
#### 颜色系统 (完整支持！)
- 命名颜色: red, blue, green, yellow 等20+常见颜色
- Hex颜色: #rgb, #rgba, #rrggbb, #rrggbbaa
- RGB/RGBA: rgb(r,g,b), rgba(r,g,b,a)
- HSL/HSLA: hsl(h,s%,l%), hsla(h,s%,l%,a)
- 透明色: transparent, currentColor

#### 背景系统
- background-color, background-image (url, gradient)
- background-position, background-size, background-repeat
- background-attachment, background-clip, background-origin

#### 边框系统
- border-width (border-top-width, border-right-width 等)
- border-style (solid, dotted, dashed 等)
- border-color
- border-radius (支持1-4个值，px和%)
- border 简写属性

#### 阴影与滤镜
- box-shadow (支持多个阴影，inset, offset, blur, spread, color)
- text-shadow (支持多个阴影)
- filter (blur, brightness, contrast, grayscale, hue-rotate 等)
- backdrop-filter

#### 其他视觉属性
- opacity (0-1)
- outline (outline-width, outline-style, outline-color, outline-offset)
- mix-blend-mode, isolation
- visibility, display
- cursor, pointer-events, user-select
- box-sizing

### 最新升级 (2026-05-22)
1. ✅ **!important 优先级支持** - 完整实现重要声明的优先级处理
2. ✅ **align-content 完整实现** - 支持所有7个值
3. ✅ **Grid auto-fill/auto-fit** - 智能轨道填充算法
4. ✅ **选择器系统完善** - 支持后代、子、相邻兄弟、通用兄弟、属性选择器
5. ✅ **完整变换功能** - 支持所有2D/3D变换函数，包括矩阵
6. ✅ **装饰模块** - 全新的 decorator.js，支持颜色、阴影、边框、背景等完整装饰属性

## 安装与使用

### 环境要求
- Node.js 14+

### 快速开始

```bash
# 克隆项目
git clone https://github.com/itszzl-sudo/pure-js-css-parser.git
cd pure-js-css-parser

# 启动服务器
npm start
```

### API使用

#### Web API - POST /api/compute

请求：
```json
{
  "html": "<div id=\"box\"></div>",
  "css": "#box { width: 100px; height: 100px; background: red; }"
}
```

响应：
```json
{
  "layout": {
    "jscss-0": { "x": 0, "y": 0, "width": 800, "height": 600 },
    "jscss-1": { "x": 0, "y": 0, "width": 100, "height": 100 }
  },
  "html": "<div id=\"box\" jscssid=\"jscss-1\" jscsslayout=\"{&quot;x&quot;:0,&quot;y&quot;:0,&quot;width&quot;:100,&quot;height&quot;:100}\"></div>"
}
```

### JavaScript API

```javascript
const JSCSS = require('./index');

const jscss = new JSCSS();

// 加载HTML
jscss.loadHTML('<div id="box">Hello</div>');

// 加载CSS
jscss.loadCSS('#box { width: 200px; height: 100px; padding: 10px; background: red; border-radius: 10px; }');

// 计算布局
jscss.computeLayout();

// 应用装饰（单独调用）
jscss.applyDecorations();

// 或者一次性计算布局和应用装饰
jscss.computeAll();

// 获取布局数据（包含装饰信息）
const layoutData = jscss.getLayoutData();
console.log(layoutData);
// [
//   {
//     jscssid: 'jscss-1',
//     jscsslayout: { x: 0, y: 0, width: 200, height: 100 },
//     jscssdecorations: {
//       backgroundColor: { type: 'rgba', r: 255, g: 0, b: 0, a: 1 },
//       borderRadius: { topLeft: 10, topRight: 10, bottomRight: 10, bottomLeft: 10 }
//     }
//   }
// ]

// 获取带属性的HTML
const htmlWithAttrs = jscss.getHTMLWithAttributes();
console.log(htmlWithAttrs);
```

#### 直接使用CSSDecorator

```javascript
const CSSDecorator = require('./decorator');

const decorator = new CSSDecorator();

// 解析颜色
const red = decorator.parseColor('red');
// { type: 'rgba', r: 255, g: 0, b: 0, a: 1 }

// 解析阴影
const shadow = decorator.parseBoxShadow('10px 5px 20px rgba(0,0,0,0.5)');
// [{ inset: false, offsetX: 10, offsetY: 5, blurRadius: 20, spreadRadius: 0, color: ... }]

// 序列化装饰为CSS
const css = decorator.serializeDecorations(decObj);
```

#### 使用 CanvasRenderer

```javascript
const CanvasRenderer = require('./canvas-renderer');
const JSCSS = require('./index');

// 创建 JSCSS 实例
const jscss = new JSCSS();
jscss.loadHTML('<div id="box">Hello</div>');
jscss.loadCSS('#box { width: 200px; height: 100px; background: red; }');
jscss.computeAll(); // 计算布局和装饰

// 在浏览器中渲染 (需要 DOM)
// 或在 Node.js 中使用 canvas 库
const canvas = document.getElementById('myCanvas');
const renderer = new CanvasRenderer(canvas);
renderer.renderFromJSCSS(jscss, 800, 600);

// 或者独立使用渲染器
renderer.drawBackground(x, y, w, h, decorations);
renderer.drawBorder(x, y, w, h, decorations);
renderer.drawRoundRect(x, y, w, h, borderRadius);
```

## 项目结构

```
pure-js-css-parser/
├── index.js                  # 主入口，JSCSS类
├── html-parser.js            # HTML解析器
├── css-parser.js             # CSS解析器（支持变量、@supports、@media）
├── layout-engine.js          # 布局引擎核心（A级别标准）
├── decorator.js              # 🆕 装饰模块 - CSS装饰属性解析
├── canvas-renderer.js        # 🆕 Canvas 渲染模块 - 绘制布局和装饰
├── server.js                 # Web API服务器
├── test.js                   # 完整测试套件（130+个测试）
├── random-test.js            # 随机测试生成器
├── debug.js                  # 调试工具
├── simple-server.js          # 简单HTTP服务器
├── package.json              # 项目配置
├── README.md                 # 项目文档
├── CSS_LAYOUT_COMPARISON.md  # 布局特性对比文档
├── cool-effects.html         # 🆕 演示页面 - 酷炫CSS效果
├── canvas-demo.html          # 🆕 演示页面 - Canvas渲染演示
└── docs/                     # 📁 GitHub Pages 部署目录
    ├── index.html            # 首页/布局工具
    ├── test.html             # 交互式测试页面
    ├── auto-test.html        # 浏览器自动测试
    ├── cool-effects.html     # 酷炫效果页面
    └── canvas-demo.html      # Canvas演示页面
```

## 测试

### 运行基础测试

```bash
node test.js
```

包含**130+个测试用例**，覆盖：
- 盒模型测试
- 各种display类型
- 定位测试
- 浮动与清除
- Flexbox布局（所有方向）
- Grid布局（auto-fill/auto-fit、minmax、fr）
- 表格布局
- 文本布局
- **!important 优先级测试**
- **选择器系统测试**（后代、子、相邻兄弟、通用兄弟、属性选择器）
- **align-content 测试**（所有7个值）
- **变换系统测试**（translate, scale, rotate, skew, matrix, 3D变换）
- **装饰模块测试**（颜色解析、阴影、边框、背景、滤镜等）
- 逻辑属性
- 书写模式
- 多列布局
- 响应式与媒体查询
- CSS变量
- Overflow与裁剪

### 运行随机测试

```bash
node random-test.js
```

生成100个复杂混合布局进行随机测试，验证布局引擎的稳定性。

## 浏览器测试

启动服务器后访问：
- `http://localhost:3000/` - 演示页面
- `http://localhost:3000/test.html` - 交互式测试
- `http://localhost:3000/auto-test.html` - 自动测试

## 项目升级历史

### 2026-05-22 - Canvas 渲染器完成！
- **全新 Canvas 渲染模块 (canvas-renderer.js)
  - 支持完整的DOM树渲染
  - 背景、边框、阴影绘制
  - 圆角矩形绘制
  - 文本渲染和换行
  - 从 JSCSS 实例直接渲染的接口
- **HTML 演示页面 (canvas-demo.html)
  - 交互式演示
  - 预设示例（简单、按钮、卡片、渐变）
  - 实时渲染预览
- 装饰模块集成到主库
- 总体完成度：100% A级别布局 + 100%装饰解析 + Canvas 渲染

### 2026-05-22 - A级别升级完成 + 装饰模块！
- 完善 !important 优先级支持
- 完整实现 align-content (7个值)
- 改进 Grid auto-fill/auto-fit 算法
- 完善选择器系统（后代、子、相邻兄弟、通用兄弟、属性选择器）
- 完整变换功能 - 支持所有2D/3D变换函数，包括矩阵计算
- **全新装饰模块 (decorator.js)
  - 颜色解析系统（命名颜色、Hex、RGB/RGBA、HSL/HSLA）
  - 边框解析系统（border-radius、border-width/color/style）
  - 阴影解析系统（box-shadow、text-shadow）
  - 滤镜解析系统（filter、backdrop-filter）
  - 背景解析系统（background-image、background-position/size等）
  - 装饰序列化功能
- 添加40+个新测试用例
- 总体完成度：100% A级别布局 + 100%装饰解析

### 之前的升级
- Margin折叠、BFC实现
- 逻辑属性支持
- 书写模式
- Grid高级特性
- 多列布局
- CSS变量
- 媒体查询

## 相关文档

- [CSS_LAYOUT_COMPARISON.md](./CSS_LAYOUT_COMPARISON.md) - 详细的CSS布局特性对比分析
- [LAYOUT_IMPROVEMENT_PLAN.md](./LAYOUT_IMPROVEMENT_PLAN.md) - 布局改进计划
- [CSS_IMPLEMENTATION_COMPARISON.md](./CSS_IMPLEMENTATION_COMPARISON.md) - CSS实现对比

## 许可证

MIT License
