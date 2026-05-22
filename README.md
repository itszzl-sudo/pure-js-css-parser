# JSCSS - Pure JavaScript HTML/CSS Parser & Layout Engine

纯JavaScript实现的HTML/CSS解析器和布局引擎，无需浏览器即可解析HTML、应用CSS样式并计算布局信息。

## 功能特性

### 核心功能
- **HTML解析**: 将HTML字符串解析为DOM树结构
- **CSS解析**: 解析CSS样式表并匹配到对应元素
- **布局计算**: 计算每个元素的精确位置和尺寸 (x, y, width, height)
- **节点标识**: 为每个HTML节点添加 `jscssid` 属性用于唯一标识
- **布局存储**: 将计算后的布局信息存储在 `jscsslayout` 属性中
- **Web API**: 提供HTTP API接口供外部调用

### 支持的CSS布局特性
- **盒模型**: margin, padding, border, content-box, border-box
- **显示模式**: block, inline, inline-block, none
- **定位**: static, relative, absolute, fixed
- **浮动**: float, clear
- **Flexbox**: flex-direction, flex-wrap, justify-content, align-items, align-content, flex-grow, flex-shrink, flex-basis, align-self, order, gap
- **Grid**: grid-template-columns, grid-template-rows, gap
- **表格**: table, thead, tbody, tfoot, tr, td, th, caption, colspan, rowspan, border-collapse
- **文本与字体**: font-size, line-height, text-align
- **尺寸**: width, height, min-width, min-height, max-width, max-height
- **单位支持**: px, %, em, rem, vw, vh, vmin, vmax, ch, ex

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
jscss.loadCSS('#box { width: 200px; height: 100px; padding: 10px; }');

// 计算布局
jscss.computeLayout();

// 获取布局数据
const layoutData = jscss.getLayoutData();
console.log(layoutData);

// 获取带属性的HTML
const htmlWithAttrs = jscss.getHTMLWithAttributes();
console.log(htmlWithAttrs);
```

## 项目结构

```
pure-js-css-parser/
├── index.js           # 主入口，JSCSS类
├── html-parser.js     # HTML解析器
├── css-parser.js      # CSS解析器
├── layout-engine.js   # 布局引擎核心
├── server.js          # Web API服务器
├── test.js            # 基础测试套件
├── random-test.js     # 随机测试生成器
├── debug.js           # 调试工具
├── package.json       # 项目配置
├── public/
│   ├── index.html     # 演示页面
│   ├── test.html      # 交互式测试页面
│   └── auto-test.html # 浏览器自动测试
└── README.md          # 项目文档
```

## 测试

### 运行基础测试

```bash
node test.js
```

包含32个测试用例，覆盖：
- 盒模型
- 各种display类型
- 定位
- 浮动
- Flexbox布局
- Grid布局
- 表格布局
- 文本布局

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

## 许可证

MIT License
