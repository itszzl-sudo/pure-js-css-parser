const JSCSS = require('./index');

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateId() {
  return 'id' + Math.random().toString(36).substr(2, 6);
}

const layoutModes = ['block', 'flex', 'grid', 'table', 'float', 'position'];

function generateStyles(mode, width) {
  switch (mode) {
    case 'block':
      return `width: ${randomInt(50, 200)}px; height: ${randomInt(30, 100)}px; margin: ${randomInt(0, 20)}px; padding: ${randomInt(0, 15)}px;`;
    case 'flex':
      const directions = ['row', 'column'];
      const justifies = ['flex-start', 'center', 'flex-end', 'space-between'];
      const aligns = ['stretch', 'center', 'flex-start', 'flex-end'];
      return `display: flex; flex-direction: ${randomChoice(directions)}; justify-content: ${randomChoice(justifies)}; align-items: ${randomChoice(aligns)}; width: ${width || 300}px;`;
    case 'grid':
      const cols = `${randomInt(1, 3)}fr `.repeat(randomInt(1, 3)).trim();
      return `display: grid; grid-template-columns: ${cols}; gap: ${randomInt(5, 20)}px; width: ${width || 300}px;`;
    case 'table':
      return `display: table; width: ${width || 300}px; border-collapse: ${randomChoice(['collapse', 'separate'])};`;
    case 'float':
      return `float: ${randomChoice(['left', 'right'])}; width: ${randomInt(50, 150)}px; height: ${randomInt(30, 80)}px;`;
    case 'position':
      const positions = ['relative', 'absolute', 'fixed'];
      const pos = randomChoice(positions);
      if (pos === 'relative') {
        return `position: relative; top: ${randomInt(0, 50)}px; left: ${randomInt(0, 50)}px; width: ${randomInt(50, 150)}px; height: ${randomInt(30, 80)}px;`;
      }
      return `position: ${pos}; top: ${randomInt(0, 100)}px; left: ${randomInt(0, 100)}px; width: ${randomInt(50, 150)}px; height: ${randomInt(30, 80)}px;`;
  }
  return '';
}

function generateBlockElement(depth = 0) {
  if (depth > 4) return '';
  const id = generateId();
  const mode = randomChoice(layoutModes);
  const children = [];
  const childCount = randomInt(1, 5);

  for (let i = 0; i < childCount; i++) {
    if (Math.random() > 0.3) {
      if (mode === 'table' && Math.random() > 0.5) {
        const rowId = generateId();
        const cellCount = randomInt(1, 4);
        let cells = '';
        for (let j = 0; j < cellCount; j++) {
          const cellId = generateId();
          const content = `Cell ${j + 1}`;
          const colspan = Math.random() > 0.8 ? ` colspan="${randomInt(2, 3)}"` : '';
          cells += `<td id="${cellId}"${colspan}>${content}</td>`;
        }
        children.push(`<tr id="${rowId}">${cells}</tr>`);
      } else if ((mode === 'flex' || mode === 'grid') && Math.random() > 0.5) {
        const childId = generateId();
        children.push(`<div id="${childId}" style="width: ${randomInt(40, 100)}px; height: ${randomInt(30, 60)}px;"></div>`);
      } else {
        const childId = generateId();
        children.push(`<div id="${childId}" style="${generateStyles('block')}">Child ${i + 1}</div>`);
      }
    }
  }

  let tag = 'div';
  let content = '';
  if (mode === 'table') {
    tag = 'table';
    content = children.map(tr => `<tbody>${tr}</tbody>`).join('');
  } else if (mode === 'flex' || mode === 'grid') {
    content = children.join('');
  } else {
    content = children.join('');
  }

  const styles = generateStyles(mode);
  return `<${tag} id="${id}" style="${styles}">${content}</${tag}>`;
}

function generateComplexHTML() {
  const sections = [];
  const sectionCount = randomInt(3, 8);

  for (let i = 0; i < sectionCount; i++) {
    const mode = randomChoice(layoutModes);
    const id = generateId();

    if (mode === 'table') {
      const rows = randomInt(2, 5);
      const cols = randomInt(2, 5);
      let tableContent = '';
      for (let r = 0; r < rows; r++) {
        let rowContent = '';
        for (let c = 0; c < cols; c++) {
          const cellId = generateId();
          const content = `R${r + 1}C${c + 1}`;
          const colspan = (r === 0 && c === 0 && Math.random() > 0.7) ? ` colspan="${randomInt(2, 3)}"` : '';
          const rowspan = (r === 0 && c === 0 && Math.random() > 0.8) ? ` rowspan="${randomInt(2, 3)}"` : '';
          rowContent += `<td id="${cellId}"${colspan}${rowspan}>${content}</td>`;
        }
        tableContent += `<tr>${rowContent}</tr>`;
      }
      sections.push(`<table id="${id}" style="width: ${randomInt(200, 500)}px; border-collapse: separate;"><tbody>${tableContent}</tbody></table>`);
    } else if (mode === 'flex') {
      const dir = randomChoice(['row', 'column']);
      const items = [];
      for (let j = 0; j < randomInt(2, 6); j++) {
        const itemId = generateId();
        items.push(`<div id="${itemId}" style="width: ${randomInt(40, 120)}px; height: ${randomInt(30, 80)}px;">Item ${j + 1}</div>`);
      }
      sections.push(`<div id="${id}" style="display: flex; flex-direction: ${dir}; width: ${randomInt(200, 400)}px;">${items.join('')}</div>`);
    } else if (mode === 'grid') {
      const cols = randomInt(2, 4);
      const items = [];
      for (let j = 0; j < randomInt(4, 10); j++) {
        const itemId = generateId();
        items.push(`<div id="${itemId}" style="width: 100%; height: ${randomInt(40, 80)}px;">Item ${j + 1}</div>`);
      }
      const colDef = `${randomInt(1, 2)}fr `.repeat(cols).trim();
      sections.push(`<div id="${id}" style="display: grid; grid-template-columns: ${colDef}; gap: ${randomInt(5, 15)}px; width: ${randomInt(200, 400)}px;">${items.join('')}</div>`);
    } else if (mode === 'float') {
      const floats = [];
      for (let j = 0; j < randomInt(2, 4); j++) {
        const floatId = generateId();
        floats.push(`<div id="${floatId}" style="float: ${randomChoice(['left', 'right'])}; width: ${randomInt(60, 120)}px; height: ${randomInt(50, 100)}px;"></div>`);
      }
      const clearId = generateId();
      floats.push(`<div id="${clearId}" style="clear: both; height: 20px;"></div>`);
      sections.push(`<div id="${id}" style="width: ${randomInt(200, 400)}px;">${floats.join('')}</div>`);
    } else if (mode === 'position') {
      const items = [];
      for (let j = 0; j < randomInt(2, 4); j++) {
        const itemId = generateId();
        const pos = randomChoice(['relative', 'absolute', 'fixed']);
        items.push(`<div id="${itemId}" style="position: ${pos}; top: ${randomInt(0, 50)}px; left: ${randomInt(0, 50)}px; width: ${randomInt(50, 100)}px; height: ${randomInt(30, 60)}px;"></div>`);
      }
      sections.push(`<div id="${id}" style="position: relative; width: ${randomInt(200, 400)}px; height: ${randomInt(150, 300)}px;">${items.join('')}</div>`);
    } else {
      const children = [];
      for (let j = 0; j < randomInt(2, 5); j++) {
        children.push(generateBlockElement(1));
      }
      sections.push(`<div id="${id}" style="width: ${randomInt(200, 400)}px; margin: ${randomInt(5, 20)}px; padding: ${randomInt(5, 15)}px;">${children.join('')}</div>`);
    }
  }

  return sections.join('\n');
}

function findAllNodes(node, results = []) {
  if (node.type === 'element' && node.jscssid) {
    results.push({
      id: node.jscssid,
      tag: node.tagName,
      layout: node.jscsslayout
    });
  }
  if (node.children) {
    for (let child of node.children) {
      findAllNodes(child, results);
    }
  }
  return results;
}

function validateLayout(node, path = '') {
  const errors = [];

  if (node.type === 'element') {
    const layout = node.jscsslayout;
    const style = node.computedStyle || {};

    if (layout.x < 0) {
      errors.push(`${path}[${node.tagName}] x=${layout.x} is negative`);
    }
    if (layout.y < 0) {
      errors.push(`${path}[${node.tagName}] y=${layout.y} is negative`);
    }
    if (layout.width < 0) {
      errors.push(`${path}[${node.tagName}] width=${layout.width} is negative`);
    }
    if (layout.height < 0) {
      errors.push(`${path}[${node.tagName}] height=${layout.height} is negative`);
    }
    if (isNaN(layout.x) || isNaN(layout.y) || isNaN(layout.width) || isNaN(layout.height)) {
      errors.push(`${path}[${node.tagName}] layout contains NaN: ${JSON.stringify(layout)}`);
    }
    if (!isFinite(layout.x) || !isFinite(layout.y) || !isFinite(layout.width) || !isFinite(layout.height)) {
      errors.push(`${path}[${node.tagName}] layout contains Infinity: ${JSON.stringify(layout)}`);
    }
    if (style.display !== 'none' && style.visibility !== 'hidden') {
      if (layout.width === 0 && layout.height === 0 && node.tagName !== 'br' && node.tagName !== 'hr') {
        const hasVisibleChildren = node.children?.some(c => {
          if (c.type !== 'element') return false;
          const cs = c.computedStyle || {};
          return cs.display !== 'none' && cs.visibility !== 'hidden';
        });
        if (!hasVisibleChildren && node.children?.length > 0) {
          errors.push(`${path}[${node.tagName}] has visible children but 0x0 size`);
        }
      }
    }
  }

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      errors.push(...validateLayout(node.children[i], `${path}${node.tagName}/`));
    }
  }

  return errors;
}

function runTest(html, css = '') {
  try {
    const jscss = new JSCSS();
    jscss.loadHTML(html);
    jscss.loadCSS(css);
    jscss.computeLayout();

    const errors = validateLayout(jscss.nodes);

    return {
      success: errors.length === 0,
      errors: errors,
      nodes: findAllNodes(jscss.nodes)
    };
  } catch (err) {
    return {
      success: false,
      errors: [`Exception: ${err.message}`],
      nodes: []
    };
  }
}

console.log('='.repeat(60));
console.log('JSCSS Random Layout Test Suite - 100 Complex Mixed Layouts');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;
const failedTests = [];
const errorSummary = {};

console.log('\nRunning tests...\n');

for (let i = 0; i < 100; i++) {
  const html = generateComplexHTML();
  const result = runTest(html);

  process.stdout.write(`\rTest ${i + 1}/100: ${result.success ? '✅' : '❌'}`);

  if (result.success) {
    passed++;
  } else {
    failed++;
    failedTests.push({
      index: i + 1,
      html: html,
      errors: result.errors
    });

    for (let err of result.errors) {
      const key = err.split('[')[1]?.split(']')[0] || err.substring(0, 50);
      errorSummary[key] = (errorSummary[key] || 0) + 1;
    }
  }
}

console.log('\n\n' + '='.repeat(60));
console.log('RESULTS');
console.log('='.repeat(60));
console.log(`Passed: ${passed}/100`);
console.log(`Failed: ${failed}/100`);

if (failed > 0) {
  console.log('\n' + '-'.repeat(60));
  console.log('ERROR SUMMARY (Most Common)');
  console.log('-'.repeat(60));

  const sorted = Object.entries(errorSummary).sort((a, b) => b[1] - a[1]);
  for (let [key, count] of sorted.slice(0, 10)) {
    console.log(`  ${key}: ${count} occurrences`);
  }

  console.log('\n' + '-'.repeat(60));
  console.log('DETAILED FAILURES (First 5)');
  console.log('-'.repeat(60));

  for (let test of failedTests.slice(0, 5)) {
    console.log(`\nTest #${test.index}:`);
    console.log(`  HTML: ${test.html.substring(0, 200)}...`);
    console.log(`  Errors:`);
    for (let err of test.errors.slice(0, 3)) {
      console.log(`    - ${err}`);
    }
  }
}

console.log('\n' + '='.repeat(60));

if (failed > 0) {
  console.log('\n⚠️  Some tests failed. Review and fix the layout engine.');
  process.exit(1);
} else {
  console.log('\n✅ All 100 tests passed! Layout engine is working correctly.');
  process.exit(0);
}
