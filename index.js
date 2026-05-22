const HTMLParser = require('./html-parser');
const CSSParser = require('./css-parser');
const LayoutEngine = require('./layout-engine');

class JSCSS {
  constructor() {
    this.htmlParser = new HTMLParser();
    this.cssParser = new CSSParser();
    this.layoutEngine = new LayoutEngine();
    this.root = null;
    this.styles = [];
  }

  loadHTML(html) {
    this.root = this.htmlParser.parse(html);
  }

  loadCSS(css) {
    this.styles = this.cssParser.parse(css);
  }

  computeLayout() {
    this.layoutEngine.compute(this.root, this.styles);
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
        jscsslayout: node.jscsslayout
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

  get nodes() {
    return this.root ? this.root.children : [];
  }
}

module.exports = JSCSS;
