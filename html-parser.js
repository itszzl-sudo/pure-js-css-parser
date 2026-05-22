class HTMLParser {
  constructor() {
    this.jscssidCounter = 0;
  }

  parse(html) {
    const nodes = [];
    let current = 0;
    let nodeStack = [];
    let root = { type: 'root', children: [], jscssid: this._generateId(), jscsslayout: {} };
    nodeStack.push(root);

    const tableStack = [];

    while (current < html.length) {
      const remaining = html.slice(current);
      
      if (remaining.startsWith('<!--')) {
        const commentEnd = remaining.indexOf('-->');
        if (commentEnd !== -1) {
          current += commentEnd + 3;
          continue;
        }
      }

      if (remaining.startsWith('</')) {
        const tagEnd = remaining.indexOf('>');
        if (tagEnd !== -1) {
          const tagName = remaining.slice(2, tagEnd).toLowerCase().trim();
          
          if (['td', 'th'].includes(tagName)) {
            if (tableStack.length > 0) {
              const tr = tableStack[tableStack.length - 1];
              if (tr._inTd) {
                tr._inTd = false;
              }
            }
          }
          
          nodeStack.pop();
          current += tagEnd + 1;
          continue;
        }
      }

      if (remaining.startsWith('<')) {
        const tagEnd = remaining.indexOf('>');
        if (tagEnd !== -1) {
          const tagContent = remaining.slice(1, tagEnd);
          const [tagName, ...attrs] = tagContent.split(/\s+/);
          const isSelfClosing = tagName.endsWith('/');
          const cleanTagName = tagName.replace('/', '').toLowerCase();

          const node = {
            type: 'element',
            tagName: cleanTagName,
            attributes: {},
            children: [],
            jscssid: this._generateId(),
            jscsslayout: {}
          };

          attrs.forEach(attr => {
            if (attr.trim()) {
              const [key, value] = attr.split('=');
              if (value) {
                node.attributes[key.toLowerCase()] = value.replace(/["']/g, '');
              }
            }
          });

          const parent = nodeStack[nodeStack.length - 1];

          if (['td', 'th'].includes(cleanTagName)) {
            let trNode = parent;
            if (parent.tagName !== 'tr') {
              trNode = {
                type: 'element',
                tagName: 'tr',
                attributes: {},
                children: [],
                jscssid: this._generateId(),
                jscsslayout: {}
              };
              parent.children.push(trNode);
              
              let tbodyNode = nodeStack[nodeStack.length - 1];
              if (tbodyNode.tagName !== 'tbody' && tbodyNode.tagName !== 'thead' && tbodyNode.tagName !== 'tfoot') {
                tbodyNode = {
                  type: 'element',
                  tagName: 'tbody',
                  attributes: {},
                  children: [],
                  jscssid: this._generateId(),
                  jscsslayout: {}
                };
                trNode.parent = tbodyNode;
                parent.children.pop();
                parent.children.push(tbodyNode);
                tbodyNode.children.push(trNode);
                nodeStack[nodeStack.length - 1] = tbodyNode;
              }
              trNode.parent = tbodyNode;
              nodeStack.push(trNode);
              trNode._inTd = true;
              tableStack.push(trNode);
            } else {
              trNode._inTd = true;
              tableStack.push(trNode);
            }
            nodeStack[nodeStack.length - 1].children.push(node);
            nodeStack.push(node);
          } else if (cleanTagName === 'tr') {
            let tbodyNode = parent;
            if (parent.tagName !== 'tbody' && parent.tagName !== 'thead' && parent.tagName !== 'tfoot') {
              tbodyNode = {
                type: 'element',
                tagName: 'tbody',
                attributes: {},
                children: [],
                jscssid: this._generateId(),
                jscsslayout: {}
              };
              tbodyNode.parent = parent;
              parent.children.push(tbodyNode);
              nodeStack[nodeStack.length - 1] = tbodyNode;
            }
            tbodyNode.children.push(node);
            nodeStack.push(node);
            tableStack.push(node);
          } else {
            nodeStack[nodeStack.length - 1].children.push(node);
            
            if (!isSelfClosing && !['br', 'hr', 'img', 'input', 'meta', 'link'].includes(cleanTagName)) {
              nodeStack.push(node);
              if (['table'].includes(cleanTagName)) {
                tableStack.push(node);
              }
            }
          }

          current += tagEnd + 1;
          continue;
        }
      }

      let textEnd = remaining.indexOf('<');
      if (textEnd === -1) textEnd = remaining.length;
      const text = remaining.slice(0, textEnd).trim();
      if (text) {
        nodeStack[nodeStack.length - 1].children.push({
          type: 'text',
          content: text
        });
      }
      current += textEnd;
    }

    return root;
  }

  serialize(node) {
    if (node.type === 'text') {
      return node.content;
    }
    if (node.type === 'root') {
      return node.children.map(child => this.serialize(child)).join('');
    }
    
    let attrs = [];
    attrs.push(`jscssid="${node.jscssid}"`);
    attrs.push(`jscsslayout='${JSON.stringify(node.jscsslayout)}'`);
    for (let [key, value] of Object.entries(node.attributes)) {
      attrs.push(`${key}="${value}"`);
    }
    const attrsStr = attrs.join(' ');
    const childrenStr = node.children.map(child => this.serialize(child)).join('');
    return `<${node.tagName} ${attrsStr}>${childrenStr}</${node.tagName}>`;
  }

  _generateId() {
    return `jscss-${this.jscssidCounter++}`;
  }
}

module.exports = HTMLParser;
