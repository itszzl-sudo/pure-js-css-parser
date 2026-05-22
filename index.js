const HTMLParser = require('./html-parser');
const CSSParser = require('./css-parser');
const LayoutEngine = require('./layout-engine');
const CSSDecorator = require('./decorator');

class JSCSS {
  constructor() {
    this.htmlParser = new HTMLParser();
    this.cssParser = new CSSParser();
    this.layoutEngine = new LayoutEngine();
    this.cssDecorator = new CSSDecorator();
    this.root = null;
    this.styles = [];
  }

  loadHTML(html) {
    this.root = this.htmlParser.parse(html);
  }

  loadCSS(css) {
    this.styles = this.cssParser.parse(css);
  }

  setViewport(width, height) {
    this.layoutEngine.setViewport(width, height);
  }

  computeLayout() {
    this.layoutEngine.compute(this.root, this.styles);
  }

  applyDecorations() {
    if (this.root) {
      this.cssDecorator.applyDecorations(this.root, this.styles);
    }
  }

  computeAll() {
    this.computeLayout();
    this.applyDecorations();
  }

  getLayoutData() {
    const results = [];
    this.collectNodes(this.root, results);
    return results;
  }

  collectNodes(node, results) {
    if (node.type === 'element' && node.jscssid) {
      results.push({
        jscssid: node.jscssid,
        jscsslayout: node.jscsslayout,
        jscssdecorations: node.jscssdecorations
      });
    }
    if (node.children) {
      for (let child of node.children) {
        this.collectNodes(child, results);
      }
    }
  }

  getHTMLWithAttributes() {
    return this.htmlParser.serialize(this.root);
  }

  getDecorations(node) {
    return this.cssDecorator.getDecorations(node);
  }

  get nodes() {
    return this.root ? this.root.children : [];
  }
}

module.exports = JSCSS;
