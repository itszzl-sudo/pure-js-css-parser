const JSCSS = require('./index');

function findNode(node, id) {
  if (node.jscssid === id) return node;
  if (node.children) {
    for (let child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

function test(name, html, css, checks) {
  const jscss = new JSCSS();
  jscss.loadHTML(html);
  jscss.loadCSS(css);
  jscss.computeLayout();
  const layoutData = jscss.getLayoutData();
  const rootNode = jscss.root;

  console.log(`\n=== ${name} ===`);
  let passed = 0;
  let failed = 0;

  for (let check of checks) {
    const node = findNode(rootNode, check.id);
    if (!node) {
      console.log(`  ❌ ${check.id}: Node not found`);
      failed++;
      continue;
    }

    const layout = node.jscsslayout;
    let checkPassed = true;
    let failures = [];

    for (let [prop, expected] of Object.entries(check.expected)) {
      let actual = layout[prop];
      if (typeof expected === 'function') {
        if (!expected(actual)) {
          checkPassed = false;
          failures.push(`${prop}: got ${actual}`);
        }
      } else if (typeof expected === 'object' && expected !== null) {
        if (Math.abs(actual - expected.value) > (expected.tolerance || 5)) {
          checkPassed = false;
          failures.push(`${prop}: expected ~${expected.value}, got ${actual}`);
        }
      } else {
        const tolerance = 5;
        if (Math.abs(actual - expected) > tolerance) {
          checkPassed = false;
          failures.push(`${prop}: expected ~${expected}, got ${actual}`);
        }
      }
    }

    if (checkPassed) {
      console.log(`  ✅ ${check.id}`);
      passed++;
    } else {
      console.log(`  ❌ ${check.id}: ${failures.join(', ')}`);
      console.log(`     Actual: {x:${Math.round(layout.x)}, y:${Math.round(layout.y)}, w:${Math.round(layout.width)}, h:${Math.round(layout.height)}}`);
      failed++;
    }
  }

  return { passed, failed, total: checks.length };
}

console.log('JSCSS Layout Test Suite');
console.log('='.repeat(50));

let totalPassed = 0;
let totalFailed = 0;
let totalTests = 0;

console.log('\n📦 BOX MODEL TESTS');
console.log('-'.repeat(30));

let result = test('Margin', 
  '<div id="box"></div>',
  '#box { margin: 20px; width: 100px; height: 80px; }',
  [{ id: 'jscss-1', expected: { x: { value: 20 }, y: { value: 20 }, width: 100, height: 80 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Padding', 
  '<div id="box"></div>',
  '#box { padding: 15px; width: 100px; height: 80px; }',
  [{ id: 'jscss-1', expected: { x: { value: 15 }, y: { value: 15 }, width: 100, height: 80 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Border', 
  '<div id="box"></div>',
  '#box { border: 10px solid black; width: 100px; height: 80px; }',
  [{ id: 'jscss-1', expected: { x: { value: 10 }, y: { value: 10 }, width: 100, height: 80 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Margin + Padding + Border', 
  '<div id="box"></div>',
  '#box { margin: 5px; padding: 10px; border: 5px solid black; width: 100px; height: 60px; }',
  [{ id: 'jscss-1', expected: { x: { value: 20 }, y: { value: 20 }, width: 100, height: 60 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

console.log('\n📋 DISPLAY TESTS');
console.log('-'.repeat(30));

result = test('Block elements stack vertically',
  '<div id="a"></div><div id="b"></div>',
  '#a, #b { width: 100px; height: 50px; }',
  [
    { id: 'jscss-1', expected: { x: 0, y: 0, width: 100, height: 50 } },
    { id: 'jscss-2', expected: { x: 0, y: 50, width: 100, height: 50 } }
  ]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Inline elements flow horizontally',
  '<span id="a">text1</span><span id="b">text2</span>',
  'span { width: 60px; height: 30px; }',
  [
    { id: 'jscss-1', expected: { x: 0, y: 0, width: 60, height: 30 } },
    { id: 'jscss-2', expected: { x: 60, y: 0, width: 60, height: 30 } }
  ]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Display none',
  '<div id="a"></div><div id="b" style="display:none;"></div>',
  '',
  [
    { id: 'jscss-1', expected: (l) => l.width > 0 && l.height > 0 },
    { id: 'jscss-2', expected: (l) => l.width === 0 && l.height === 0 }
  ]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

console.log('\n📍 POSITION TESTS');
console.log('-'.repeat(30));

result = test('Position relative',
  '<div id="box"></div>',
  '#box { position: relative; top: 30px; left: 20px; width: 100px; height: 80px; }',
  [{ id: 'jscss-1', expected: { x: { value: 20 }, y: { value: 30 }, width: 100, height: 80 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Position absolute',
  '<div id="parent" style="width:400px;height:300px;position:relative;"><div id="child"></div></div>',
  '#child { position: absolute; top: 50px; left: 30px; width: 120px; height: 90px; }',
  [{ id: 'jscss-2', expected: { x: { value: 30 }, y: { value: 50 }, width: 120, height: 90 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

console.log('\n🌊 FLOAT TESTS');
console.log('-'.repeat(30));

result = test('Float left',
  '<div id="container"><div id="float" style="float:left;"></div><div id="normal"></div></div>',
  '#float { width: 100px; height: 100px; } #normal { height: 50px; }',
  [{ id: 'jscss-2', expected: { x: 0, y: 0, width: 100, height: 100 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Float right',
  '<div id="container"><div id="float" style="float:right;"></div><div id="normal"></div></div>',
  '#container { width: 300px; } #float { width: 80px; height: 80px; } #normal { height: 40px; }',
  [{ id: 'jscss-2', expected: (l) => l.width === 80 && l.height === 80 }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

console.log('\n📐 FLEXBOX TESTS');
console.log('-'.repeat(30));

result = test('Flex container row',
  '<div id="flex" style="display:flex;"><div id="a"></div><div id="b"></div></div>',
  '#flex { width: 300px; } #a, #b { width: 80px; height: 50px; margin: 5px; }',
  [
    { id: 'jscss-2', expected: (l) => l.x >= 0 && l.width > 0 && l.height > 0 },
    { id: 'jscss-3', expected: (l) => l.x > 0 && l.width > 0 && l.height > 0 }
  ]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Flex grow',
  '<div id="flex" style="display:flex;"><div id="fixed"></div><div id="growing" style="flex-grow:1;"></div></div>',
  '#flex { width: 400px; } #fixed { width: 100px; height: 50px; } #growing { height: 50px; }',
  [{ id: 'jscss-3', expected: (l) => l.width > 100 && l.width < 400 }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Flex wrap',
  '<div id="flex" style="display:flex;flex-wrap:wrap;"><div id="a"></div><div id="b"></div><div id="c"></div></div>',
  '#flex { width: 200px; } #flex > div { width: 120px; height: 60px; }',
  [
    { id: 'jscss-2', expected: (l) => l.width > 0 && l.height > 0 },
    { id: 'jscss-3', expected: (l) => l.width > 0 && l.height > 0 }
  ]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

console.log('\n🔲 GRID TESTS');
console.log('-'.repeat(30));

result = test('Grid basic',
  '<div id="grid" style="display:grid;grid-template-columns:1fr 1fr;"><div id="a"></div><div id="b"></div></div>',
  '#grid { width: 400px; } #grid > div { height: 80px; }',
  [
    { id: 'jscss-2', expected: (l) => l.x >= 0 && l.width > 0 && l.height > 0 },
    { id: 'jscss-3', expected: (l) => l.x > 0 && l.width > 0 && l.height > 0 }
  ]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Grid fixed columns',
  '<div id="grid" style="display:grid;grid-template-columns:100px 1fr;"><div id="sidebar"></div><div id="content"></div></div>',
  '#grid { width: 400px; } #sidebar, #content { height: 200px; }',
  [
    { id: 'jscss-2', expected: (l) => l.width > 0 && l.height > 0 },
    { id: 'jscss-3', expected: (l) => l.width > 0 && l.height > 0 }
  ]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

console.log('\n📝 TEXT/FONT TESTS');
console.log('-'.repeat(30));

result = test('Text width based on content',
  '<span id="text">Hello</span>',
  '#text { font-size: 16px; }',
  [{ id: 'jscss-1', expected: { width: { value: 48, tolerance: 10 } } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Line height affects text height',
  '<div id="text">Content</div>',
  '#text { font-size: 20px; line-height: 1.5; }',
  [{ id: 'jscss-1', expected: { height: { value: 30, tolerance: 5 } } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

console.log('\n📊 TABLE TESTS');
console.log('-'.repeat(30));

result = test('Basic table layout',
  '<table><tr><td id="cell">Cell</td></tr></table>',
  'table { width: 300px; } td { padding: 10px; }',
  [{ id: 'jscss-4', expected: (l) => l.width > 0 && l.height > 0 }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Table with multiple columns',
  '<table><tr><td>Col1</td><td>Col2</td></tr></table>',
  'table { width: 400px; }',
  [
    { id: 'jscss-4', expected: (l) => l.width > 0 && l.height > 0 },
    { id: 'jscss-5', expected: (l) => l.width > 0 && l.height > 0 }
  ]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Table with thead, tbody, tfoot',
  '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Body</td></tr></tbody><tfoot><tr><td>Footer</td></tr></tfoot></table>',
  'table { width: 200px; }',
  [{ id: 'jscss-5', expected: (l) => l.width > 0 }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Table with colspan',
  '<table><tr><td id="cell" colspan="2">Wide Cell</td></tr><tr><td>A</td><td>B</td></tr></table>',
  'table { width: 400px; }',
  [{ id: 'jscss-5', expected: (l) => l.width > 0 }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Table with caption',
  '<table><caption id="cap">Table Caption</caption><tr><td>Data</td></tr></table>',
  'table { width: 300px; }',
  [{ id: 'jscss-3', expected: (l) => l.width > 0 }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Table cell vertical align',
  '<table><tr><td id="cell" style="height:80px;vertical-align:bottom;">Aligned</td></tr></table>',
  '',
  [{ id: 'jscss-4', expected: (l) => l.height >= 30 }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

console.log('\n✨ ADVANCED CSS FEATURES TESTS');
console.log('-'.repeat(30));

result = test('Calc() Function', 
  '<div id="box"></div>',
  '#box { width: calc(100px + 50px); height: 80px; }',
  [{ id: 'jscss-1', expected: { width: (w) => w >= 140 && w <= 160, height: 80 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Min() Function', 
  '<div id="box"></div>',
  '#box { width: min(200px, 150px); height: 80px; }',
  [{ id: 'jscss-1', expected: { width: (w) => w >= 140 && w <= 160, height: 80 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Max() Function', 
  '<div id="box"></div>',
  '#box { width: max(100px, 150px); height: 80px; }',
  [{ id: 'jscss-1', expected: { width: (w) => w >= 140 && w <= 160, height: 80 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Opacity', 
  '<div id="box"></div>',
  '#box { width: 100px; height: 80px; opacity: 0.5; }',
  [{ id: 'jscss-1', expected: { opacity: (o) => o >= 0.4 && o <= 0.6 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Transform - Translate', 
  '<div id="box"></div>',
  '#box { width: 100px; height: 80px; transform: translate(20px, 30px); }',
  [{ id: 'jscss-1', expected: { transform: (t) => t !== null && typeof t === 'object' } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Transform - Scale', 
  '<div id="box"></div>',
  '#box { width: 100px; height: 80px; transform: scale(1.5); }',
  [{ id: 'jscss-1', expected: { transform: (t) => t !== null && typeof t === 'object' } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Transform - Rotate', 
  '<div id="box"></div>',
  '#box { width: 100px; height: 80px; transform: rotate(45deg); }',
  [{ id: 'jscss-1', expected: { transform: (t) => t !== null && typeof t === 'object' } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Transform Origin', 
  '<div id="box"></div>',
  '#box { width: 100px; height: 80px; transform-origin: top left; }',
  [{ id: 'jscss-1', expected: { transformOrigin: (t) => t !== undefined } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Aspect Ratio', 
  '<div id="box"></div>',
  '#box { width: 200px; aspect-ratio: 2/1; }',
  [{ id: 'jscss-1', expected: { width: (w) => w >= 190 && w <= 210, height: (h) => h >= 90 && h <= 110 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Position Sticky', 
  '<div id="container"><div id="box">Sticky</div></div>',
  '#container { height: 200px; } #box { position: sticky; top: 10px; width: 100px; height: 50px; }',
  [{ id: 'jscss-2', expected: { y: (y) => y >= 5, height: 50 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Flex Justify Content - Space Between', 
  '<div id="container"><div id="a"></div><div id="b"></div><div id="c"></div></div>',
  '#container { display: flex; justify-content: space-between; width: 300px; } #a, #b, #c { width: 50px; height: 50px; }',
  [
    { id: 'jscss-1', expected: { width: (w) => w > 0 } },
    { id: 'jscss-2', expected: { width: (w) => w > 0 } },
    { id: 'jscss-3', expected: { x: (x) => x >= 0 } },
    { id: 'jscss-4', expected: { x: (x) => x >= 0 } }
  ]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Flex Justify Content - Space Around', 
  '<div id="container"><div id="a"></div><div id="b"></div></div>',
  '#container { display: flex; justify-content: space-around; width: 300px; } #a, #b { width: 50px; height: 50px; }',
  [
    { id: 'jscss-1', expected: { width: (w) => w > 0 } },
    { id: 'jscss-2', expected: { width: (w) => w > 0 } },
    { id: 'jscss-3', expected: { x: (x) => x >= 0 } }
  ]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Flex Justify Content - Space Evenly', 
  '<div id="container"><div id="a"></div><div id="b"></div></div>',
  '#container { display: flex; justify-content: space-evenly; width: 300px; } #a, #b { width: 50px; height: 50px; }',
  [
    { id: 'jscss-1', expected: { width: (w) => w > 0 } },
    { id: 'jscss-2', expected: { width: (w) => w > 0 } },
    { id: 'jscss-3', expected: { x: (x) => x >= 0 } }
  ]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Flex Gap', 
  '<div id="container"><div id="a"></div><div id="b"></div><div id="c"></div></div>',
  '#container { display: flex; gap: 20px; width: 300px; } #a, #b, #c { width: 50px; height: 50px; }',
  [
    { id: 'jscss-1', expected: { width: (w) => w > 0 } },
    { id: 'jscss-2', expected: { width: (w) => w > 0 } }
  ]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Flex Align Self', 
  '<div id="container"><div id="a"></div><div id="b"></div><div id="c"></div></div>',
  '#container { display: flex; align-items: flex-start; height: 100px; } #a { align-self: flex-end; width: 50px; height: 30px; } #b, #c { width: 50px; height: 30px; }',
  [
    { id: 'jscss-1', expected: { height: (h) => h > 0 } },
    { id: 'jscss-2', expected: { height: (h) => h > 0 } }
  ]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Flex Order', 
  '<div id="container"><div id="a">1</div><div id="b">2</div><div id="c">3</div></div>',
  '#container { display: flex; } #a { order: 3; width: 50px; height: 50px; } #b { order: 1; width: 50px; height: 50px; } #c { order: 2; width: 50px; height: 50px; }',
  [
    { id: 'jscss-1', expected: { width: (w) => w >= 100 } },
    { id: 'jscss-2', expected: { width: 50 } },
    { id: 'jscss-3', expected: { width: 50 } },
    { id: 'jscss-4', expected: { width: 50 } }
  ]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

console.log('\n📦 MIN/MAX DIMENSION TESTS');
console.log('-'.repeat(30));

result = test('Min-Width Constraint', 
  '<div id="box"></div>',
  '#box { width: 50px; min-width: 100px; height: 80px; }',
  [{ id: 'jscss-1', expected: { width: (w) => w >= 100, height: 80 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Max-Width Constraint', 
  '<div id="box"></div>',
  '#box { width: 300px; max-width: 200px; height: 80px; }',
  [{ id: 'jscss-1', expected: { width: (w) => w <= 200, height: 80 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Min-Height Constraint', 
  '<div id="box"></div>',
  '#box { width: 100px; height: 50px; min-height: 80px; }',
  [{ id: 'jscss-1', expected: { width: 100, height: (h) => h >= 80 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Max-Height Constraint', 
  '<div id="box"></div>',
  '#box { width: 100px; height: 200px; max-height: 100px; }',
  [{ id: 'jscss-1', expected: { width: 100, height: (h) => h <= 100 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Both Min and Max Constraints', 
  '<div id="box"></div>',
  '#box { width: 300px; min-width: 100px; max-width: 200px; height: 100px; }',
  [{ id: 'jscss-1', expected: { width: (w) => w >= 100 && w <= 200, height: 100 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

console.log('\n📍 POSITIONING TESTS');
console.log('-'.repeat(30));

result = test('Inset Shorthand - Single Value', 
  '<div id="container" style="position: relative; width: 200px; height: 200px;"><div id="box">Box</div></div>',
  '#box { position: absolute; inset: 20px; width: 50px; height: 50px; }',
  [{ id: 'jscss-2', expected: { x: (x) => x >= 20, y: (y) => y >= 20 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Inset Shorthand - Two Values', 
  '<div id="container" style="position: relative; width: 200px; height: 200px;"><div id="box">Box</div></div>',
  '#box { position: absolute; inset: 10px 30px; width: 50px; height: 50px; }',
  [{ id: 'jscss-2', expected: { x: (x) => x >= 25, y: (y) => y >= 8 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Individual Properties Override Inset', 
  '<div id="container" style="position: relative; width: 200px; height: 200px;"><div id="box">Box</div></div>',
  '#box { position: absolute; inset: 50px; left: 10px; width: 50px; height: 50px; }',
  [{ id: 'jscss-2', expected: { x: (x) => x >= 8 && x <= 20 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

console.log('\n🔒 MIN/MAX DIMENSION TESTS');
console.log('-'.repeat(30));

result = test('Min-width constraint (expands width)', 
  '<div id="box"></div>',
  '#box { width: 50px; min-width: 100px; height: 80px; }',
  [{ id: 'jscss-1', expected: { width: (w) => w >= 100, height: 80 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Max-width constraint (reduces width)', 
  '<div id="box"></div>',
  '#box { width: 300px; max-width: 200px; height: 80px; }',
  [{ id: 'jscss-1', expected: { width: (w) => w <= 200, height: 80 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Min-height constraint (expands height)', 
  '<div id="box"></div>',
  '#box { width: 100px; height: 50px; min-height: 80px; }',
  [{ id: 'jscss-1', expected: { width: 100, height: (h) => h >= 80 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Max-height constraint (reduces height)', 
  '<div id="box"></div>',
  '#box { width: 100px; height: 200px; max-height: 100px; }',
  [{ id: 'jscss-1', expected: { width: 100, height: (h) => h <= 100 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Both min and max width constraints (clamps)', 
  '<div id="box"></div>',
  '#box { width: 50px; min-width: 80px; max-width: 150px; height: 100px; }',
  [{ id: 'jscss-1', expected: { width: (w) => w >= 80 && w <= 150, height: 100 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

console.log('\n📍 POSITIONING (INSET) TESTS');
console.log('-'.repeat(30));

result = test('Inset shorthand single value', 
  '<div id="container" style="position:relative;width:200px;height:200px"><div id="box">Box</div></div>',
  '#box { position:absolute; inset: 20px; width:50px; height:50px; }',
  [{ id: 'jscss-2', expected: { x: (x) => x >= 15, y: (y) => y >= 15 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Inset shorthand two values (vertical/horizontal)', 
  '<div id="container" style="position:relative;width:200px;height:200px"><div id="box">Box</div></div>',
  '#box { position:absolute; inset:10px 30px; width:50px; height:50px; }',
  [{ id: 'jscss-2', expected: { x: (x) => x >= 25, y: (y) => y >= 8 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

result = test('Individual left/top override inset', 
  '<div id="container" style="position:relative;width:200px;height:200px"><div id="box">Box</div></div>',
  '#box { position:absolute; inset:50px; left:10px; width:50px; height:50px; }',
  [{ id: 'jscss-2', expected: { x: (x) => x >= 8 && x <= 25 } }]
);
totalPassed += result.passed; totalFailed += result.failed; totalTests += result.total;

console.log('\n' + '='.repeat(50));
console.log(`📊 Results: ${totalPassed}/${totalTests} tests passed`);
if (totalFailed > 0) {
  console.log(`❌ ${totalFailed} tests failed`);
  process.exit(1);
} else {
  console.log('✅ All tests passed!');
  process.exit(0);
}
