class LayoutEngine {
  constructor() {
    this.fontSize = 16;
    this.lineHeight = 1.2;
    this.inheritedProperties = new Set([
      'color', 'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'fontVariant', 'font',
      'lineHeight', 'letterSpacing', 'wordSpacing', 'textAlign', 'textIndent', 'textTransform',
      'textDecoration', 'textShadow', 'textOverflow', 'whiteSpace', 'wordWrap', 'overflowWrap',
      'visibility', 'borderCollapse', 'borderSpacing', 'captionSide', 'cursor', 'direction',
      'unicodeBidi', 'writingMode', 'textOrientation', 'verticalAlign', 'quotes', 'listStyleType',
      'listStylePosition', 'listStyleImage', 'opacity', 'pointerEvents', 'userSelect'
    ]);
    this.cssEngineRules = [];
    this.viewportWidth = 800;
    this.viewportHeight = 600;
  }

  setViewport(width, height) {
    this.viewportWidth = width || 800;
    this.viewportHeight = height || 600;
  }

  compute(root, styles) {
    this.collectAllNodes(root);
    this.prepareCSSRules(styles);
    this.applyStyles(root, styles);
    this.computeFlexbox(root);
    this.computeGrid(root);
    this.computeMarginCollapse(root);
    this.layoutNode(root, 0, 0, this.viewportWidth, this.viewportHeight);
    this.resolveAbsolutePosition(root);
    this.applyZIndex(root);
  }

  prepareCSSRules(styles) {
    this.cssEngineRules = styles.map(rule => ({
      ...rule,
      specificity: this.calculateSpecificity(rule.selector),
      order: styles.indexOf(rule)
    })).sort((a, b) => {
      if (b.specificity - a.specificity !== 0) {
        return b.specificity - a.specificity;
      }
      return b.order - a.order;
    });
  }

  calculateSpecificity(selector) {
    let specificity = { id: 0, class: 0, element: 0 };
    
    const parts = selector.split(/[\s>+~]+/);
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      const idMatch = trimmed.match(/#[\w-]+/g);
      if (idMatch) specificity.id += idMatch.length;
      
      const classMatch = trimmed.match(/\.[\w-]+/g);
      if (classMatch) specificity.class += classMatch.length;
      
      const attrMatch = trimmed.match(/\[[\w-]+\s*[=~|^$*]?=["']?[^"'\]]*["']?\]/g);
      if (attrMatch) specificity.class += attrMatch.length;
      
      const pseudoClassMatch = trimmed.match(/:[\w-]+(\([^)]*\))?/g);
      if (pseudoClassMatch) specificity.class += pseudoClassMatch.length;
      
      const elementMatch = trimmed.match(/^[\w-]+/);
      if (elementMatch && elementMatch[0] !== '*') {
        specificity.element += 1;
      }
    }
    
    return specificity.id * 10000 + specificity.class * 100 + specificity.element;
  }

  collectAllNodes(node, ancestors = []) {
    node.ancestors = [...ancestors];
    if (node.children) {
      for (let child of node.children) {
        this.collectAllNodes(child, [...ancestors, node]);
      }
    }
  }

  applyStyles(node, styles, parent = null, inheritedValues = {}) {
    const parentStyle = parent?.computedStyle || {};
    node.computedStyle = { ...this.getDefaultStyle(node) };
    node._customProperties = { ...(parent?._customProperties || {}) };
    
    for (const prop of this.inheritedProperties) {
      if (inheritedValues[prop] !== undefined) {
        node.computedStyle[prop] = inheritedValues[prop];
      } else if (parentStyle[prop] !== undefined) {
        node.computedStyle[prop] = parentStyle[prop];
      }
    }
    
    const matchedRules = [];
    if (node.type === 'element') {
      for (const rule of this.cssEngineRules) {
        if (rule.mediaQuery && !this.matchesMediaQuery(rule.mediaQuery)) {
          continue;
        }
        
        if (this.matchesSelector(node, rule.selector, parent)) {
          matchedRules.push(rule);
        }
      }
      
      matchedRules.sort((a, b) => {
        const importantA = a.isImportant || false;
        const importantB = b.isImportant || false;
        
        if (importantB && !importantA) return 1;
        if (importantA && !importantB) return -1;
        
        if (b.specificity - a.specificity !== 0) {
          return b.specificity - a.specificity;
        }
        return b.order - a.order;
      });
      
      const importantValues = {};
      const normalValues = {};
      
      for (const rule of matchedRules) {
        if (rule.variables) {
          Object.assign(node._customProperties, rule.variables);
        }
        
        const ruleImportantDeclarations = rule.importantDeclarations || new Set();
        
        for (let [key, value] of Object.entries(rule.declarations)) {
          const camelKey = this.toCamelCase(key);
          
          if (key.startsWith('--')) {
            node._customProperties[key] = value;
            continue;
          }
          
          let resolvedValue = value;
          if (value === 'inherit') {
            resolvedValue = parentStyle[camelKey];
          } else if (value === 'initial') {
            resolvedValue = this.getInitialValue(camelKey);
          } else if (value === 'unset') {
            if (this.inheritedProperties.has(camelKey)) {
              resolvedValue = parentStyle[camelKey] || this.getInitialValue(camelKey);
            } else {
              resolvedValue = this.getInitialValue(camelKey);
            }
          } else if (value === 'revert') {
            resolvedValue = inheritedValues[camelKey] || this.getInitialValue(camelKey);
          } else {
            resolvedValue = this.resolveCSSVariable(value, node);
          }
          
          if (resolvedValue !== undefined && resolvedValue !== 'inherit' && resolvedValue !== 'initial' && resolvedValue !== 'unset' && resolvedValue !== 'revert') {
            if (ruleImportantDeclarations.has(key)) {
              importantValues[camelKey] = resolvedValue;
            } else {
              if (!importantValues.hasOwnProperty(camelKey)) {
                normalValues[camelKey] = resolvedValue;
              }
            }
          }
        }
      }
      
      Object.assign(node.computedStyle, normalValues);
      Object.assign(node.computedStyle, importantValues);
      
      if (node.attributes.style) {
        const styleStr = node.attributes.style;
        const inlineImportantValues = {};
        const inlineNormalValues = {};
        
        styleStr.split(';').forEach(decl => {
          const [prop, value] = decl.split(':');
          if (prop && value) {
            const propTrimmed = prop.trim();
            const camelKey = this.toCamelCase(propTrimmed);
            let finalValue = value.trim();
            
            if (propTrimmed.startsWith('--')) {
              node._customProperties[propTrimmed] = finalValue;
              return;
            }
            
            const isImportant = finalValue.toLowerCase().endsWith('!important');
            if (isImportant) {
              finalValue = finalValue.slice(0, -'!important'.length).trim();
            }
            
            if (finalValue === 'inherit') {
              finalValue = node.computedStyle[camelKey];
            } else if (finalValue === 'initial') {
              finalValue = this.getInitialValue(camelKey);
            } else if (finalValue === 'unset') {
              if (this.inheritedProperties.has(camelKey)) {
                finalValue = inheritedValues[camelKey] || this.getInitialValue(camelKey);
              } else {
                finalValue = this.getInitialValue(camelKey);
              }
            } else {
              finalValue = this.resolveCSSVariable(finalValue, node);
            }
            
            if (isImportant) {
              inlineImportantValues[camelKey] = finalValue;
            } else {
              if (!importantValues.hasOwnProperty(camelKey) && !inlineImportantValues.hasOwnProperty(camelKey)) {
                inlineNormalValues[camelKey] = finalValue;
              }
            }
          }
        });
        
        Object.assign(node.computedStyle, inlineNormalValues);
        Object.assign(node.computedStyle, inlineImportantValues);
      }
      
      this.parseBorderShorthand(node.computedStyle);
      this.computeFontProperties(node);
      this.computeBoxSizing(node);
      this.computeLogicalProperties(node);
      this.computeWritingMode(node);
      this.computeAlignment(node);
      this.computeOverflow(node);
    }
    
    this.resolveAllCSSVariables(node);
    
    const newInheritedValues = {};
    for (const prop of this.inheritedProperties) {
      newInheritedValues[prop] = node.computedStyle[prop];
    }
    
    if (node.children) {
      for (let child of node.children) {
        child.parent = node;
        this.applyStyles(child, styles, node, newInheritedValues);
      }
    }
  }
  
  resolveCSSVariable(value, node) {
    if (!value || typeof value !== 'string') {
      return value;
    }
    
    const varRegex = /var\(\s*([^,)]+)(?:\s*,\s*([^)]+))?\s*\)/g;
    
    return value.replace(varRegex, (match, varName, fallback) => {
      varName = varName.trim();
      
      if (node._customProperties && node._customProperties[varName]) {
        return this.resolveCSSVariable(node._customProperties[varName], node);
      }
      
      let current = node.parent;
      while (current) {
        if (current._customProperties && current._customProperties[varName]) {
          return this.resolveCSSVariable(current._customProperties[varName], current);
        }
        current = current.parent;
      }
      
      if (fallback !== undefined) {
        return this.resolveCSSVariable(fallback.trim(), node);
      }
      
      return match;
    });
  }
  
  resolveAllCSSVariables(node) {
    for (const [key, value] of Object.entries(node.computedStyle)) {
      if (typeof value === 'string' && value.includes('var(')) {
        node.computedStyle[key] = this.resolveCSSVariable(value, node);
      }
    }
    
    if (node.children) {
      for (const child of node.children) {
        this.resolveAllCSSVariables(child);
      }
    }
  }

  getInitialValue(property) {
    const initialValues = {
      display: 'inline',
      position: 'static',
      width: 'auto',
      height: 'auto',
      margin: '0',
      padding: '0',
      borderWidth: '0',
      top: 'auto',
      left: 'auto',
      right: 'auto',
      bottom: 'auto',
      float: 'none',
      clear: 'none',
      fontSize: '16px',
      lineHeight: 'normal',
      textAlign: 'left',
      verticalAlign: 'baseline',
      visibility: 'visible',
      overflow: 'visible',
      zIndex: 'auto',
      color: 'black',
      backgroundColor: 'transparent',
      opacity: '1',
      transform: 'none',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      alignContent: 'stretch',
      flexGrow: '0',
      flexShrink: '1',
      flexBasis: 'auto',
      order: '0',
      gap: '0',
      columnCount: 'auto',
      columnWidth: 'auto',
      columnGap: '20px',
      columnSpan: 'none',
      columnFill: 'balance',
      writingMode: 'horizontal-tb',
      direction: 'ltr',
      whiteSpace: 'normal',
      wordWrap: 'normal',
      overflowWrap: 'normal',
      textOverflow: 'clip',
      cursor: 'auto',
      userSelect: 'auto',
      pointerEvents: 'auto'
    };
    return initialValues[property] || 'auto';
  }

  matchesMediaQuery(mediaQuery) {
    if (!mediaQuery || mediaQuery === 'all') return true;
    
    const widthMatch = mediaQuery.match(/min-width:\s*(\d+)px/);
    if (widthMatch && this.viewportWidth < parseInt(widthMatch[1])) return false;
    
    const maxWidthMatch = mediaQuery.match(/max-width:\s*(\d+)px/);
    if (maxWidthMatch && this.viewportWidth > parseInt(maxWidthMatch[1])) return false;
    
    const heightMatch = mediaQuery.match(/min-height:\s*(\d+)px/);
    if (heightMatch && this.viewportHeight < parseInt(heightMatch[1])) return false;
    
    const maxHeightMatch = mediaQuery.match(/max-height:\s*(\d+)px/);
    if (maxHeightMatch && this.viewportHeight > parseInt(maxHeightMatch[1])) return false;
    
    const orientationMatch = mediaQuery.match(/orientation:\s*(landscape|portrait)/);
    if (orientationMatch) {
      const orientation = this.viewportWidth > this.viewportHeight ? 'landscape' : 'portrait';
      if (orientationMatch[1] !== orientation) return false;
    }
    
    return true;
  }

  computeLogicalProperties(node) {
    const style = node.computedStyle;
    const writingMode = style.writingMode || 'horizontal-tb';
    const direction = style.direction || 'ltr';
    
    const isHorizontal = writingMode === 'horizontal-tb';
    const isVertical = !isHorizontal;
    const isRTL = direction === 'rtl';
    const isLTR = direction === 'ltr';
    
    const marginInline = style.marginInline;
    const marginBlock = style.marginBlock;
    const paddingInline = style.paddingInline;
    const paddingBlock = style.paddingBlock;
    const insetInline = style.insetInline;
    const insetBlock = style.insetBlock;
    const borderInline = style.borderInline;
    const borderBlock = style.borderBlock;
    const borderInlineWidth = style.borderInlineWidth;
    const borderBlockWidth = style.borderBlockWidth;
    
    if (marginInline !== undefined && marginInline !== 'auto' && marginInline !== '0px') {
      const parts = marginInline.split(/\s+/);
      const parsed = parts.map(p => this.parseLength(p, 800) || 0);
      
      if (parts.length === 1) {
        if (isHorizontal) {
          if (isRTL) {
            style.marginLeft = parsed[0];
            style.marginRight = parsed[0];
          } else {
            style.marginLeft = parsed[0];
            style.marginRight = parsed[0];
          }
        } else {
          style.marginTop = parsed[0];
          style.marginBottom = parsed[0];
        }
      } else if (parts.length === 2) {
        if (isHorizontal) {
          style.marginTop = parsed[0];
          style.marginBottom = parsed[0];
          if (isRTL) {
            style.marginLeft = parsed[1];
            style.marginRight = parsed[1];
          } else {
            style.marginLeft = parsed[1];
            style.marginRight = parsed[1];
          }
        } else {
          if (isRTL) {
            style.marginTop = parsed[1];
            style.marginBottom = parsed[1];
          } else {
            style.marginTop = parsed[1];
            style.marginBottom = parsed[1];
          }
          style.marginLeft = parsed[0];
          style.marginRight = parsed[0];
        }
      }
    }
    
    if (marginBlock !== undefined && marginBlock !== 'auto' && marginBlock !== '0px') {
      const parts = marginBlock.split(/\s+/);
      const parsed = parts.map(p => this.parseLength(p, 800) || 0);
      
      if (parts.length === 1) {
        if (isHorizontal) {
          style.marginTop = parsed[0];
          style.marginBottom = parsed[0];
        } else {
          style.marginLeft = parsed[0];
          style.marginRight = parsed[0];
        }
      } else if (parts.length === 2) {
        if (isHorizontal) {
          style.marginTop = parsed[0];
          style.marginBottom = parsed[1];
        } else {
          style.marginLeft = parsed[0];
          style.marginRight = parsed[1];
        }
      }
    }
    
    if (paddingInline !== undefined && paddingInline !== '0' && paddingInline !== '0px') {
      const parts = paddingInline.split(/\s+/);
      const parsed = parts.map(p => this.parseLength(p, 800) || 0);
      
      if (parts.length === 1) {
        if (isHorizontal) {
          style.paddingLeft = parsed[0];
          style.paddingRight = parsed[0];
        } else {
          style.paddingTop = parsed[0];
          style.paddingBottom = parsed[0];
        }
      } else if (parts.length === 2) {
        if (isHorizontal) {
          style.paddingTop = parsed[0];
          style.paddingBottom = parsed[0];
          style.paddingLeft = parsed[1];
          style.paddingRight = parsed[1];
        } else {
          style.paddingTop = parsed[1];
          style.paddingBottom = parsed[1];
          style.paddingLeft = parsed[0];
          style.paddingRight = parsed[0];
        }
      }
    }
    
    if (paddingBlock !== undefined && paddingBlock !== '0' && paddingBlock !== '0px') {
      const parts = paddingBlock.split(/\s+/);
      const parsed = parts.map(p => this.parseLength(p, 800) || 0);
      
      if (parts.length === 1) {
        if (isHorizontal) {
          style.paddingTop = parsed[0];
          style.paddingBottom = parsed[0];
        } else {
          style.paddingLeft = parsed[0];
          style.paddingRight = parsed[0];
        }
      } else if (parts.length === 2) {
        if (isHorizontal) {
          style.paddingTop = parsed[0];
          style.paddingBottom = parsed[1];
        } else {
          style.paddingLeft = parsed[0];
          style.paddingRight = parsed[1];
        }
      }
    }
    
    if (insetInline !== undefined && insetInline !== 'auto') {
      const parts = insetInline.split(/\s+/);
      const parsed = parts.map(p => this.parseLength(p, 800) || 0);
      
      if (parts.length === 1) {
        if (isHorizontal) {
          style.left = parsed[0];
          style.right = parsed[0];
        } else {
          style.top = parsed[0];
          style.bottom = parsed[0];
        }
      } else if (parts.length === 2) {
        if (isHorizontal) {
          style.top = parsed[0];
          style.bottom = parsed[0];
          style.left = parsed[1];
          style.right = parsed[1];
        } else {
          style.top = parsed[1];
          style.bottom = parsed[1];
          style.left = parsed[0];
          style.right = parsed[0];
        }
      }
    }
    
    if (insetBlock !== undefined && insetBlock !== 'auto') {
      const parts = insetBlock.split(/\s+/);
      const parsed = parts.map(p => this.parseLength(p, 800) || 0);
      
      if (parts.length === 1) {
        if (isHorizontal) {
          style.top = parsed[0];
          style.bottom = parsed[0];
        } else {
          style.left = parsed[0];
          style.right = parsed[0];
        }
      } else if (parts.length === 2) {
        if (isHorizontal) {
          style.top = parsed[0];
          style.bottom = parsed[1];
        } else {
          style.left = parsed[0];
          style.right = parsed[1];
        }
      }
    }
    
    if (borderInline !== undefined && borderInline !== '0px') {
      const parts = borderInline.split(/\s+/);
      const parsed = parts.map(p => this.parseLength(p, 800) || 0);
      
      if (parts.length >= 1) {
        const width = parsed[0] || 0;
        if (isHorizontal) {
          style.borderLeftWidth = width;
          style.borderRightWidth = width;
        } else {
          style.borderTopWidth = width;
          style.borderBottomWidth = width;
        }
      }
    }
    
    if (borderBlock !== undefined && borderBlock !== '0px') {
      const parts = borderBlock.split(/\s+/);
      const parsed = parts.map(p => this.parseLength(p, 800) || 0);
      
      if (parts.length >= 1) {
        const width = parsed[0] || 0;
        if (isHorizontal) {
          style.borderTopWidth = width;
          style.borderBottomWidth = width;
        } else {
          style.borderLeftWidth = width;
          style.borderRightWidth = width;
        }
      }
    }
    
    if (borderInlineWidth !== undefined && borderInlineWidth !== '0px') {
      const width = this.parseLength(borderInlineWidth, 800) || 0;
      if (isHorizontal) {
        style.borderLeftWidth = width;
        style.borderRightWidth = width;
      } else {
        style.borderTopWidth = width;
        style.borderBottomWidth = width;
      }
    }
    
    if (borderBlockWidth !== undefined && borderBlockWidth !== '0px') {
      const width = this.parseLength(borderBlockWidth, 800) || 0;
      if (isHorizontal) {
        style.borderTopWidth = width;
        style.borderBottomWidth = width;
      } else {
        style.borderLeftWidth = width;
        style.borderRightWidth = width;
      }
    }
  }

  computeMarginCollapse(node) {
    const style = node.computedStyle;
    if (!node.children || node.children.length === 0) return;
    
    const display = style.display || 'block';
    const position = style.position || 'static';
    
    if (display === 'none' || display === 'absolute' || display === 'fixed' ||
        position === 'absolute' || position === 'fixed') {
      return;
    }
    
    const flowRoot = display === 'flow-root' || display === 'flow-root-inline' ||
                     display === 'grid' || display === 'flex' ||
                     display === 'inline-block' || display === 'table' ||
                     display === 'inline-flex' || display === 'inline-grid';
    if (flowRoot) {
      return;
    }
    
    let collapsed = false;
    
    // Handle margin collapse between siblings
    for (let i = 0; i < node.children.length - 1; i++) {
      const child1 = node.children[i];
      const child2 = node.children[i + 1];
      
      if (child1.type !== 'element' || child2.type !== 'element') continue;
      
      const style1 = child1.computedStyle || {};
      const style2 = child2.computedStyle || {};
      
      const display1 = style1.display || 'block';
      const display2 = style2.display || 'block';
      const position1 = style1.position || 'static';
      const position2 = style2.position || 'static';
      
      // Check if these elements are candidates for margin collapse
      const isCollapsible1 = this.isCollapsibleElement(child1);
      const isCollapsible2 = this.isCollapsibleElement(child2);
      
      if (!isCollapsible1 || !isCollapsible2) continue;
      
      const margin1 = this.parseBoxShorthand(style1);
      const margin2 = this.parseBoxShorthand(style2);
      
      const marginBottom1 = margin1.bottom || 0;
      const marginTop2 = margin2.top || 0;
      
      if (marginBottom1 > 0 || marginTop2 > 0) {
        const collapsedMargin = this.calculateCollapsedMargin(marginBottom1, marginTop2);
        
        if (child2._collapsedMargins === undefined) {
          child2._collapsedMargins = {};
        }
        child2._collapsedMargins.top = collapsedMargin;
        
        if (child2.jscsslayout) {
          child2.jscsslayout._collapsedMarginTop = collapsedMargin;
        }
        
        collapsed = true;
      }
    }
    
    // Handle margin collapse between parent and first child
    if (node.children.length > 0) {
      const firstChild = node.children[0];
      if (firstChild.type === 'element' && this.isCollapsibleElement(firstChild)) {
        const parentMargin = this.parseBoxShorthand(style);
        const childMargin = this.parseBoxShorthand(firstChild.computedStyle || {});
        
        const parentTop = parentMargin.top || 0;
        const childTop = childMargin.top || 0;
        
        if (parentTop > 0 || childTop > 0) {
          const collapsedMargin = this.calculateCollapsedMargin(parentTop, childTop);
          if (node._collapsedMargins === undefined) {
            node._collapsedMargins = {};
          }
          node._collapsedMargins.top = collapsedMargin;
          collapsed = true;
        }
      }
    }
    
    // Handle margin collapse between parent and last child
    if (node.children.length > 0) {
      const lastChild = node.children[node.children.length - 1];
      if (lastChild.type === 'element' && this.isCollapsibleElement(lastChild)) {
        const parentMargin = this.parseBoxShorthand(style);
        const childMargin = this.parseBoxShorthand(lastChild.computedStyle || {});
        
        const parentBottom = parentMargin.bottom || 0;
        const childBottom = childMargin.bottom || 0;
        
        if (parentBottom > 0 || childBottom > 0) {
          const collapsedMargin = this.calculateCollapsedMargin(parentBottom, childBottom);
          if (node._collapsedMargins === undefined) {
            node._collapsedMargins = {};
          }
          node._collapsedMargins.bottom = collapsedMargin;
          collapsed = true;
        }
      }
    }
    
    if (collapsed) {
      style._hasCollapsedMargins = true;
    }
    
    // Recursively compute margin collapse for children
    for (const child of node.children) {
      if (child.type === 'element') {
        this.computeMarginCollapse(child);
      }
    }
  }

  isCollapsibleElement(node) {
    const style = node.computedStyle || {};
    const display = style.display || 'block';
    const position = style.position || 'static';
    const float = style.float || 'none';
    
    if (display === 'none' || display === 'inline' || 
        display === 'inline-block' || display === 'inline-flex' || 
        display === 'inline-grid' || display === 'table' ||
        display === 'table-cell' || display === 'table-caption' ||
        display === 'flex' || display === 'grid' || 
        display === 'flow-root' || display === 'flow-root-inline') {
      return false;
    }
    
    if (position === 'absolute' || position === 'fixed') {
      return false;
    }
    
    if (float !== 'none') {
      return false;
    }
    
    return true;
  }

  calculateCollapsedMargin(margin1, margin2) {
    // Handle positive margin collapse
    if (margin1 >= 0 && margin2 >= 0) {
      return Math.max(margin1, margin2);
    }
    
    // Handle negative margin collapse
    if (margin1 <= 0 && margin2 <= 0) {
      return Math.min(margin1, margin2);
    }
    
    // Handle mixed margin collapse
    return margin1 + margin2;
  }

  applyMarginCollapse(layout, node) {
    if (!layout || !node.jscsslayout) return;
    
    const style = node.computedStyle || {};
    
    if (style._hasCollapsedMargins || node._collapsedMargins) {
      const margin = this.parseBoxShorthand(style);
      
      // Apply collapsed top margin to layout
      if (node._collapsedMargins && node._collapsedMargins.top !== undefined) {
        const collapsedTop = node._collapsedMargins.top;
        layout._adjustedY = layout.y + (collapsedTop - (margin.top || 0));
      }
    }
  }

  getMaxCollapsibleMargin(node) {
    if (!node.children) return 0;
    
    let maxMargin = 0;
    
    for (const child of node.children) {
      if (child.type !== 'element') continue;
      
      if (this.isCollapsibleElement(child)) {
        const childStyle = child.computedStyle || {};
        const childMargin = this.parseBoxShorthand(childStyle);
        
        maxMargin = Math.max(maxMargin, childMargin.top || 0, childMargin.bottom || 0);
      }
    }
    
    return maxMargin;
  }

  computeWritingMode(node) {
    const style = node.computedStyle;
    const writingMode = style.writingMode || 'horizontal-tb';
    
    if (writingMode === 'vertical-rl' || writingMode === 'vertical-lr') {
      style._isVertical = true;
      style._writingMode = writingMode;
    } else {
      style._isVertical = false;
      style._writingMode = 'horizontal-tb';
    }
  }

  computeAlignment(node) {
    const style = node.computedStyle;
    
    const textAlign = style.textAlign || 'left';
    const direction = style.direction || 'ltr';
    
    style._textAlign = textAlign;
    style._textDirection = direction;
    
    const verticalAlign = style.verticalAlign || 'baseline';
    style._verticalAlign = verticalAlign;
    
    if (style.lineHeight === 'normal' || !style.lineHeight) {
      const fontSize = this.parseLength(style.fontSize, 800) || 16;
      style.lineHeight = (fontSize * 1.2) + 'px';
    }
    
    style._lineHeight = this.parseLength(style.lineHeight, 800) || 20;
  }

  applyTextAlign(node) {
    const style = node.computedStyle;
    const textAlign = style._textAlign || 'left';
    const direction = style._textDirection || 'ltr';
    
    if (node.type === 'text' && node.parent) {
      const parentLayout = node.parent.jscsslayout;
      const parentStyle = node.parent.computedStyle || {};
      
      if (!parentLayout) return;
      
      let effectiveAlign = textAlign;
      if (textAlign === 'start') {
        effectiveAlign = direction === 'rtl' ? 'right' : 'left';
      } else if (textAlign === 'end') {
        effectiveAlign = direction === 'rtl' ? 'left' : 'right';
      }
      
      const textWidth = node.content ? node.content.length * 8 : 0;
      const parentWidth = parentLayout.width || 100;
      
      let x = parentLayout.x;
      if (effectiveAlign === 'center') {
        x = parentLayout.x + (parentWidth - textWidth) / 2;
      } else if (effectiveAlign === 'right') {
        x = parentLayout.x + parentWidth - textWidth;
      }
      
      node.jscsslayout.x = Math.max(parentLayout.x, x);
    }
    
    if (node.children) {
      for (const child of node.children) {
        this.applyTextAlign(child);
      }
    }
  }

  applyVerticalAlign(node, containerHeight, lineHeight = 20) {
    const style = node.computedStyle;
    const verticalAlign = style._verticalAlign || 'baseline';
    
    if (!node.jscsslayout) return;
    
    const layout = node.jscsslayout;
    const elementHeight = layout._outerHeight || layout.height;
    
    if (elementHeight < containerHeight) {
      let extraY = 0;
      const fontSize = this.parseLength(style.fontSize, 800) || 16;
      const halfFontSize = fontSize / 2;
      
      switch (verticalAlign) {
        case 'middle':
          extraY = (containerHeight - elementHeight) / 2 - halfFontSize;
          break;
        case 'bottom':
        case 'text-bottom':
          extraY = containerHeight - elementHeight;
          break;
        case 'top':
        case 'text-top':
          extraY = 0;
          break;
        case 'baseline':
        default:
          extraY = 0;
          break;
        case 'super':
          extraY = -lineHeight * 0.5;
          break;
        case 'sub':
          extraY = lineHeight * 0.5;
          break;
        case 'percentage':
          extraY = (containerHeight * (parseFloat(style.verticalAlign) / 100)) - elementHeight / 2;
          break;
        case 'length':
          extraY = parseFloat(style.verticalAlign);
          break;
      }
      
      layout.y += extraY;
    }
  }

  computeOverflow(node) {
    const style = node.computedStyle;
    
    const overflowX = style.overflowX || style.overflow || 'visible';
    const overflowY = style.overflowY || style.overflow || 'visible';
    const overflowWrap = style.overflowWrap || style.wordWrap || 'normal';
    const textOverflow = style.textOverflow || 'clip';
    const whiteSpace = style.whiteSpace || 'normal';
    
    style._overflowX = overflowX;
    style._overflowY = overflowY;
    style._overflowWrap = overflowWrap;
    style._textOverflow = textOverflow;
    style._whiteSpace = whiteSpace;
    
    style._hasOverflow = overflowX !== 'visible' || overflowY !== 'visible';
    style._hasClipping = overflowX === 'hidden' || overflowX === 'clip' || 
                        overflowY === 'hidden' || overflowY === 'clip';
    style._hasScrollbar = overflowX === 'scroll' || overflowY === 'scroll';
    style._hasAutoScroll = overflowX === 'auto' || overflowY === 'auto';
    
    if (node.jscsslayout) {
      node.jscsslayout._overflowX = overflowX;
      node.jscsslayout._overflowY = overflowY;
      node.jscsslayout._hasOverflow = style._hasOverflow;
      node.jscsslayout._hasClipping = style._hasClipping;
      node.jscsslayout._hasScrollbar = style._hasScrollbar;
      node.jscsslayout._hasAutoScroll = style._hasAutoScroll;
    }
  }

  handleOverflow(node) {
    const style = node.computedStyle;
    const layout = node.jscsslayout;
    
    if (!layout) return;
    
    const overflowX = style._overflowX || 'visible';
    const overflowY = style._overflowY || 'visible';
    
    layout._clipped = false;
    
    if (overflowX === 'hidden' || overflowX === 'clip') {
      layout._clippedWidth = layout.width;
      layout._clipped = true;
      layout._clippedSide = 'x';
    }
    
    if (overflowY === 'hidden' || overflowY === 'clip') {
      layout._clippedHeight = layout.height;
      layout._clipped = true;
      layout._clippedSide = layout._clippedSide ? 'both' : 'y';
    }
    
    if (overflowX === 'auto' || overflowY === 'auto') {
      layout._autoScroll = true;
      
      const hasOverflowContent = this.detectOverflowContent(node);
      if (hasOverflowContent.x) {
        layout._needsHorizontalScroll = true;
      }
      if (hasOverflowContent.y) {
        layout._needsVerticalScroll = true;
      }
    }
    
    if (overflowX === 'scroll' || overflowY === 'scroll') {
      layout._scrollable = true;
      layout._alwaysShowScrollbar = true;
      
      if (overflowX === 'scroll') {
        layout._scrollbarWidth = 17;
        layout._innerWidth = layout.width - 17;
      }
      if (overflowY === 'scroll') {
        layout._scrollbarHeight = 17;
        layout._innerHeight = layout.height - 17;
      }
    }
    
    this.applyTextOverflow(node);
    this.applyWhiteSpace(node);
  }

  detectOverflowContent(node) {
    const layout = node.jscsslayout;
    if (!layout) return { x: false, y: false };
    
    let hasOverflowX = false;
    let hasOverflowY = false;
    
    if (node.children) {
      for (const child of node.children) {
        if (!child.jscsslayout) continue;
        
        const childLayout = child.jscsslayout;
        const childRight = childLayout.x + (childLayout.width || 0);
        const childBottom = childLayout.y + (childLayout.height || 0);
        
        if (childRight > layout.x + layout.width) {
          hasOverflowX = true;
        }
        if (childBottom > layout.y + layout.height) {
          hasOverflowY = true;
        }
        
        if (hasOverflowX && hasOverflowY) break;
      }
    }
    
    return { x: hasOverflowX, y: hasOverflowY };
  }

  applyTextOverflow(node) {
    const style = node.computedStyle;
    const textOverflow = style._textOverflow || 'clip';
    const overflowX = style._overflowX || 'visible';
    const whiteSpace = style._whiteSpace || 'normal';
    const layout = node.jscsslayout;
    
    if (!layout || !node.children) return;
    
    if (textOverflow === 'ellipsis' && overflowX !== 'visible' && whiteSpace === 'nowrap') {
      for (const child of node.children) {
        if (child.type === 'text' && child.content) {
          const contentWidth = child.content.length * 8;
          const maxWidth = layout.width - (layout._scrollbarWidth || 0);
          
          if (contentWidth > maxWidth) {
            const maxChars = Math.floor((maxWidth - 24) / 8);
            child.content = child.content.substring(0, maxChars) + '...';
            child._ellipsisApplied = true;
          }
        }
      }
    }
    
    if (textOverflow === 'clip' && overflowX !== 'visible') {
      for (const child of node.children) {
        if (child.type === 'text' && child.content) {
          const contentWidth = child.content.length * 8;
          const maxWidth = layout.width - (layout._scrollbarWidth || 0);
          
          if (contentWidth > maxWidth) {
            const maxChars = Math.floor(maxWidth / 8);
            child.content = child.content.substring(0, maxChars);
            child._clipped = true;
          }
        }
      }
    }
  }

  applyWhiteSpace(node) {
    const style = node.computedStyle;
    const whiteSpace = style._whiteSpace || 'normal';
    const layout = node.jscsslayout;
    
    if (!layout) return;
    
    if (whiteSpace === 'nowrap') {
      layout._nowrap = true;
      
      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'text') {
            child._nowrap = true;
          }
        }
      }
    } else if (whiteSpace === 'pre') {
      layout._preserveWhitespace = true;
      layout._nowrap = true;
    } else if (whiteSpace === 'pre-wrap') {
      layout._preserveWhitespace = true;
      layout._wrapLines = true;
    } else if (whiteSpace === 'pre-line') {
      layout._collapseWhitespace = true;
      layout._wrapLines = true;
    }
  }

  wrapText(node, maxWidth) {
    const style = node.computedStyle;
    const overflowWrap = style._overflowWrap || 'normal';
    const whiteSpace = style._whiteSpace || 'normal';
    
    if (whiteSpace === 'nowrap') return;
    
    if (overflowWrap === 'break-word' || overflowWrap === 'anywhere') {
      if (node.type === 'text' && node.content) {
        const charWidth = 8;
        const maxCharsPerLine = Math.max(1, Math.floor(maxWidth / charWidth));
        const words = node.content.split(/(\s+)/);
        
        let lines = [];
        let currentLine = '';
        
        for (const word of words) {
          if (!word.trim()) {
            currentLine += word;
            continue;
          }
          
          const testLine = currentLine + word;
          if (testLine.length <= maxCharsPerLine) {
            currentLine = testLine;
          } else {
            if (currentLine.trim()) {
              lines.push(currentLine);
            }
            
            if (word.length > maxCharsPerLine) {
              let remaining = word;
              while (remaining.length > maxCharsPerLine) {
                lines.push(remaining.substring(0, maxCharsPerLine));
                remaining = remaining.substring(maxCharsPerLine);
              }
              currentLine = remaining;
            } else {
              currentLine = word;
            }
          }
        }
        
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        
        node.content = lines.join('\n');
        node._wrappedLines = lines.length;
        node._wrapped = true;
      }
    } else if (whiteSpace === 'normal' || whiteSpace === 'pre-wrap' || whiteSpace === 'pre-line') {
      if (node.type === 'text' && node.content) {
        const charWidth = 8;
        const maxCharsPerLine = Math.max(1, Math.floor(maxWidth / charWidth));
        const words = node.content.split(/(\s+)/);
        
        let lines = [];
        let currentLine = '';
        
        for (const word of words) {
          if (!word.trim()) {
            currentLine += word;
            continue;
          }
          
          const testLine = currentLine + word;
          if (testLine.length <= maxCharsPerLine || !currentLine.trim()) {
            currentLine = testLine;
          } else {
            if (currentLine.trim()) {
              lines.push(currentLine);
            }
            currentLine = word;
          }
        }
        
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        
        node.content = lines.join('\n');
        node._wrappedLines = lines.length;
      }
    }
  }

  toCamelCase(str) {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }

  parseBorderShorthand(style) {
    if (style.border && style.border !== 'none') {
      const existingWidth = style.borderWidth;
      const needsParse = !existingWidth || existingWidth === '0' || existingWidth === 0;
      if (needsParse) {
        const parts = style.border.split(/\s+/);
        for (const part of parts) {
          const numMatch = part.match(/^(\d+)px$/);
          if (numMatch) {
            style.borderWidth = part;
            break;
          }
        }
      }
    }
  }

  matchesSelector(node, selector, parent) {
    if (node.type !== 'element') return false;
    const selectors = selector.split(',').map(s => s.trim());
    for (const sel of selectors) {
      if (this.matchesComplexSelector(node, sel, parent)) {
        return true;
      }
    }
    return false;
  }
  
  matchesComplexSelector(node, selector, parent) {
    if (!node || node.type !== 'element') return false;
    
    const parts = this.parseSelectorParts(selector);
    if (parts.length === 0) return false;
    
    return this.matchesSelectorChain(node, parts, parts.length - 1);
  }
  
  parseSelectorParts(selector) {
    const parts = [];
    const tokens = selector.split(/\s*([>+~])?\s*/).filter(t => t && t.trim());
    
    let currentCombinator = null;
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      if (token === '>' || token === '+' || token === '~') {
        currentCombinator = token;
      } else {
        parts.push({
          selector: token.trim(),
          combinator: currentCombinator
        });
        currentCombinator = null;
      }
    }
    
    return parts;
  }
  
  matchesSelectorChain(node, parts, index) {
    if (index < 0) return true;
    
    const part = parts[index];
    const currentSelector = part.selector;
    
    if (!this.matchesSimpleSelector(node, currentSelector)) {
      return false;
    }
    
    if (index === 0) {
      return true;
    }
    
    const combinator = part.combinator || ' ';
    const previousPart = parts[index - 1];
    
    switch (combinator) {
      case '>':
        return node.parent && this.matchesSelectorChain(node.parent, parts, index - 1);
        
      case '+':
        if (!node.parent) return false;
        const prevSibling = this.getPreviousSibling(node);
        return prevSibling && this.matchesSelectorChain(prevSibling, parts, index - 1);
        
      case '~':
        if (!node.parent) return false;
        let sibling = this.getPreviousSibling(node);
        while (sibling) {
          if (this.matchesSelectorChain(sibling, parts, index - 1)) {
            return true;
          }
          sibling = this.getPreviousSibling(sibling);
        }
        return false;
        
      default:
        let ancestor = node.parent;
        while (ancestor) {
          if (this.matchesSelectorChain(ancestor, parts, index - 1)) {
            return true;
          }
          ancestor = ancestor.parent;
        }
        return false;
    }
  }
  
  matchesSimpleSelector(node, selector) {
    if (!node || node.type !== 'element') return false;
    
    if (selector === '*') {
      return true;
    }
    
    if (selector.startsWith('#')) {
      return node.attributes && node.attributes.id === selector.slice(1);
    }
    
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      if (!node.attributes || !node.attributes.class) return false;
      return node.attributes.class.split(' ').includes(className);
    }
    
    const attrMatch = selector.match(/^([\w-]+)\[([\w-]+)\s*([=~|^$*])?\s*["']?([^"'\]]*)["']?\]/);
    if (attrMatch) {
      const tagName = attrMatch[1];
      const attrName = attrMatch[2];
      const operator = attrMatch[3] || '';
      const attrValue = attrMatch[4];
      
      if (tagName !== '*' && node.tagName !== tagName) return false;
      if (!node.attributes || !(attrName in node.attributes)) return false;
      
      const nodeAttrValue = node.attributes[attrName];
      
      switch (operator) {
        case '=':
          return nodeAttrValue === attrValue;
        case '~':
          return nodeAttrValue.split(' ').includes(attrValue);
        case '|':
          return nodeAttrValue === attrValue || nodeAttrValue.startsWith(attrValue + '-');
        case '^':
          return nodeAttrValue.startsWith(attrValue);
        case '$':
          return nodeAttrValue.endsWith(attrValue);
        case '*':
          return nodeAttrValue.includes(attrValue);
        default:
          return true;
      }
    }
    
    return node.tagName === selector;
  }
  
  getPreviousSibling(node) {
    if (!node || !node.parent) return null;
    
    const children = node.parent.children || [];
    const index = children.indexOf(node);
    
    if (index > 0) {
      return children[index - 1];
    }
    
    return null;
  }

  getDefaultStyle(node) {
    const defaults = {
      display: 'block',
      position: 'static',
      width: 'auto',
      height: 'auto',
      margin: '0',
      marginTop: '0',
      marginRight: '0',
      marginBottom: '0',
      marginLeft: '0',
      padding: '0',
      paddingTop: '0',
      paddingRight: '0',
      paddingBottom: '0',
      paddingLeft: '0',
      borderWidth: '0',
      borderTopWidth: '0',
      borderRightWidth: '0',
      borderBottomWidth: '0',
      borderLeftWidth: '0',
      borderStyle: 'none',
      top: 'auto',
      left: 'auto',
      right: 'auto',
      bottom: 'auto',
      float: 'none',
      clear: 'none',
      fontSize: '16px',
      lineHeight: 'normal',
      textAlign: 'left',
      verticalAlign: 'baseline',
      visibility: 'visible',
      overflow: 'visible',
      overflowX: 'visible',
      overflowY: 'visible',
      zIndex: 'auto',
      boxSizing: 'content-box',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      alignContent: 'stretch',
      alignSelf: 'auto',
      flexGrow: '0',
      flexShrink: '1',
      flexBasis: 'auto',
      order: '0',
      gap: '0',
      rowGap: '0',
      columnGap: '0',
      gridTemplateColumns: 'none',
      gridTemplateRows: 'none',
      gridTemplateAreas: 'none',
      gridColumn: 'auto',
      gridRow: 'auto',
      gridArea: 'auto',
      gridColumnGap: '0',
      gridRowGap: '0',
      gridGap: '0',
      gridAutoFlow: 'row',
      gridAutoColumns: 'auto',
      gridAutoRows: 'auto',
      columnCount: 'auto',
      columnWidth: 'auto',
      columnGap: '20px',
      columnRuleWidth: '0',
      columnRuleStyle: 'none',
      columnRuleColor: 'currentColor',
      columnSpan: 'none',
      columnFill: 'balance',
      transform: 'none',
      transformOrigin: '50% 50%',
      opacity: '1',
      borderCollapse: 'separate',
      borderSpacing: '0',
      captionSide: 'top',
      tableLayout: 'auto',
      whiteSpace: 'normal',
      minWidth: 'auto',
      maxWidth: 'none',
      minHeight: 'auto',
      maxHeight: 'none',
      aspectRatio: 'auto',
      wordWrap: 'normal',
      overflowWrap: 'normal',
      outline: 'none',
      outlineWidth: '0',
      outlineStyle: 'none',
      outlineColor: 'currentColor',
      objectFit: 'fill',
      objectPosition: '50% 50%',
      resize: 'none',
      cursor: 'auto',
      pointerEvents: 'auto',
      userSelect: 'auto',
      boxShadow: 'none',
      textShadow: 'none',
      backdropFilter: 'none',
      filter: 'none',
      transition: 'all 0s ease 0s',
      animation: 'none',
      writingMode: 'horizontal-tb',
      direction: 'ltr',
      textOrientation: 'mixed',
      marginInline: '0',
      marginBlock: '0',
      paddingInline: '0',
      paddingBlock: '0',
      insetInline: 'auto',
      insetBlock: 'auto',
      textOverflow: 'clip',
      overflowX: 'visible',
      overflowY: 'visible'
    };
    if (node.type === 'element') {
      if (['span', 'a', 'strong', 'em', 'b', 'i', 'u', 'code', 'small'].includes(node.tagName)) {
        defaults.display = 'inline';
      }
      if (['img', 'input', 'br', 'hr', 'meta', 'link'].includes(node.tagName)) {
        defaults.display = 'inline-block';
      }
      if (['table'].includes(node.tagName)) {
        defaults.display = 'table';
      }
      if (['thead', 'tbody', 'tfoot', 'tr'].includes(node.tagName)) {
        defaults.display = 'table-row-group';
      }
      if (['td', 'th'].includes(node.tagName)) {
        defaults.display = 'table-cell';
      }
      if (['caption'].includes(node.tagName)) {
        defaults.display = 'table-caption';
      }
      if (['colgroup'].includes(node.tagName)) {
        defaults.display = 'table-column-group';
      }
      if (['col'].includes(node.tagName)) {
        defaults.display = 'table-column';
      }
    }
    return defaults;
  }

  computeFontProperties(node) {
    const style = node.computedStyle;
    const fontSize = this.parseLength(style.fontSize, 100);
    if (fontSize > 0) {
      this.fontSize = fontSize;
    }
    if (style.lineHeight === 'normal' || !style.lineHeight) {
      style.lineHeight = (this.fontSize * 1.2) + 'px';
    } else if (typeof style.lineHeight === 'number' || /^\d+(\.\d+)?$/.test(style.lineHeight)) {
      const multiplier = typeof style.lineHeight === 'number' ? style.lineHeight : parseFloat(style.lineHeight);
      style.lineHeight = (this.fontSize * multiplier) + 'px';
    }
  }

  computeBoxSizing(node) {
    const style = node.computedStyle;
    const boxSizing = style.boxSizing || 'content-box';
    
    style._useBorderBox = boxSizing === 'border-box';
    style._useContentBox = boxSizing === 'content-box';
    
    if (node.jscsslayout) {
      const layout = node.jscsslayout;
      
      if (style._useBorderBox) {
        const borderLeft = style.borderLeftWidth || 0;
        const borderRight = style.borderRightWidth || 0;
        const borderTop = style.borderTopWidth || 0;
        const borderBottom = style.borderBottomWidth || 0;
        
        const paddingLeft = style.paddingLeft || 0;
        const paddingRight = style.paddingRight || 0;
        const paddingTop = style.paddingTop || 0;
        const paddingBottom = style.paddingBottom || 0;
        
        layout._borderPaddingWidth = borderLeft + borderRight + paddingLeft + paddingRight;
        layout._borderPaddingHeight = borderTop + borderBottom + paddingTop + paddingBottom;
        
        layout._contentWidth = Math.max(0, layout.width - layout._borderPaddingWidth);
        layout._contentHeight = Math.max(0, layout.height - layout._borderPaddingHeight);
      } else {
        layout._contentWidth = layout.width;
        layout._contentHeight = layout.height;
        layout._borderPaddingWidth = 0;
        layout._borderPaddingHeight = 0;
      }
      
      layout._boxSizing = boxSizing;
    }
  }

  computeFlexbox(node) {
    if (node.type === 'element' && node.computedStyle.display === 'flex') {
      const style = node.computedStyle;
      node._flexContainer = {
        direction: style.flexDirection,
        wrap: style.flexWrap,
        justifyContent: style.justifyContent,
        alignItems: style.alignItems,
        alignContent: style.alignContent,
        gap: this.parseLength(style.gap, 100),
        rowGap: this.parseLength(style.rowGap, 100),
        columnGap: this.parseLength(style.columnGap, 100)
      };
    }
    if (node.children) {
      for (let child of node.children) {
        this.computeFlexbox(child);
      }
    }
  }

  computeGrid(node) {
    if (node.type === 'element' && node.computedStyle.display === 'grid') {
      const style = node.computedStyle;
      node._gridContainer = {
        columns: this.parseGridTemplate(style.gridTemplateColumns),
        rows: this.parseGridTemplate(style.gridTemplateRows),
        areas: style.gridTemplateAreas
      };
    }
    if (node.children) {
      for (let child of node.children) {
        this.computeGrid(child);
      }
    }
  }

  parseGridTemplate(template) {
    if (!template || template === 'none') return [];
    
    const parseTrack = (track) => {
      track = track.trim();
      
      if (track.endsWith('fr')) {
        return { type: 'fr', value: parseFloat(track), min: null, max: null };
      } else if (track.endsWith('px')) {
        return { type: 'px', value: parseFloat(track), min: null, max: null };
      } else if (track.endsWith('%')) {
        return { type: 'percent', value: parseFloat(track), min: null, max: null };
      } else if (track === 'auto') {
        return { type: 'auto', value: null, min: null, max: null };
      } else if (track === 'min-content') {
        return { type: 'min-content', value: null, min: null, max: null };
      } else if (track === 'max-content') {
        return { type: 'max-content', value: null, min: null, max: null };
      } else {
        return { type: 'auto', value: null, min: null, max: null };
      }
    };
    
    const parseMinMax = (expr) => {
      const match = expr.match(/minmax\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/i);
      if (!match) return null;
      
      const minStr = match[1].trim();
      const maxStr = match[2].trim();
      
      let minValue = null;
      let minType = 'px';
      let maxValue = null;
      let maxType = 'fr';
      
      if (minStr === 'min-content') {
        minValue = 'min-content';
        minType = 'min-content';
      } else if (minStr === 'max-content') {
        minValue = 'max-content';
        minType = 'max-content';
      } else if (minStr.endsWith('fr')) {
        minValue = parseFloat(minStr);
        minType = 'fr';
      } else if (minStr.endsWith('%')) {
        minValue = parseFloat(minStr);
        minType = 'percent';
      } else if (minStr.endsWith('px')) {
        minValue = parseFloat(minStr);
        minType = 'px';
      } else {
        minValue = parseFloat(minStr);
        minType = 'px';
      }
      
      if (maxStr === 'min-content') {
        maxValue = 'min-content';
        maxType = 'min-content';
      } else if (maxStr === 'max-content') {
        maxValue = 'max-content';
        maxType = 'max-content';
      } else if (maxStr === 'auto') {
        maxValue = null;
        maxType = 'auto';
      } else if (maxStr.endsWith('fr')) {
        maxValue = parseFloat(maxStr);
        maxType = 'fr';
      } else if (maxStr.endsWith('%')) {
        maxValue = parseFloat(maxStr);
        maxType = 'percent';
      } else if (maxStr.endsWith('px')) {
        maxValue = parseFloat(maxStr);
        maxType = 'px';
      } else {
        maxValue = parseFloat(maxStr);
        maxType = 'px';
      }
      
      return { type: 'minmax', min: { value: minValue, unit: minType }, max: { value: maxValue, unit: maxType } };
    };
    
    const expandRepeat = (template) => {
      const result = [];
      const repeatMatch = template.match(/repeat\s*\(\s*(\d+|auto-fill|auto-fit)\s*,\s*(.+?)\s*\)/gi);
      
      if (!repeatMatch) {
        return template.split(/\s+/);
      }
      
      let expanded = template;
      for (const match of repeatMatch) {
        const innerMatch = match.match(/repeat\s*\(\s*(\d+|auto-fill|auto-fit)\s*,\s*(.+?)\s*\)/i);
        if (innerMatch) {
          const count = innerMatch[1];
          const trackList = innerMatch[2];
          
          if (count === 'auto-fill' || count === 'auto-fit') {
            expanded = expanded.replace(match, `{REPEAT_${count}_START}${trackList}{REPEAT_END}`);
          } else {
            const numCount = parseInt(count);
            const tracks = trackList.split(/\s+/);
            const repeated = [];
            for (let i = 0; i < numCount; i++) {
              repeated.push(...tracks);
            }
            expanded = expanded.replace(match, repeated.join(' '));
          }
        }
      }
      
      if (expanded.includes('{REPEAT_')) {
        return expanded;
      }
      
      return expanded.split(/\s+/);
    };
    
    const tracks = expandRepeat(template);
    
    if (typeof tracks === 'string') {
      return {
        raw: tracks,
        isAutoFill: tracks.includes('{REPEAT_auto-fill_START}'),
        isAutoFit: tracks.includes('{REPEAT_auto-fit_START}')
      };
    }
    
    return tracks.map(item => {
      const minMax = parseMinMax(item);
      if (minMax) return minMax;
      return parseTrack(item);
    });
  }

  layoutNode(node, x, y, maxWidth, maxHeight, containingBlock = null) {
    if (!node.jscsslayout) node.jscsslayout = {};
    let style = node.computedStyle || {};
    node.containingBlock = containingBlock;

    if (style.display === 'none' || style.visibility === 'hidden') {
      node.jscsslayout = { x: 0, y: 0, width: 0, height: 0 };
      return;
    }

    const margin = this.parseBoxShorthand(style);
    const padding = this.parseBoxShorthand(style, 'padding');
    const border = this.parseBoxShorthand(style, 'border');

    let width = this.resolveWidth(node, maxWidth, margin, padding, border);
    let height = this.resolveHeight(node, maxHeight, margin, padding, border);

    const aspectRatio = this.parseAspectRatio(style.aspectRatio);
    
    if (aspectRatio) {
      const ratio = aspectRatio.width / aspectRatio.height;
      const widthIsAuto = style.width === 'auto' || style.width === undefined;
      const heightIsAuto = style.height === 'auto' || style.height === undefined;
      
      if (!widthIsAuto && !isNaN(width) && heightIsAuto) {
        height = width / ratio;
      } else if (!heightIsAuto && !isNaN(height) && widthIsAuto) {
        width = height * ratio;
      } else if (widthIsAuto && heightIsAuto) {
        const contentWidth = this.calculateContentWidth(node, maxWidth);
        const contentHeight = this.calculateContentHeight(node, maxHeight);
        
        if (contentWidth > 0) {
          width = contentWidth;
          height = width / ratio;
        } else if (contentHeight > 0) {
          height = contentHeight;
          width = height * ratio;
        }
      }
    }
    
    const minWidth = this.parseLength(style.minWidth, maxWidth);
    const maxWidthParsed = this.parseLength(style.maxWidth, maxWidth);
    const minHeight = this.parseLength(style.minHeight, maxHeight);
    const maxHeightParsed = this.parseLength(style.maxHeight, maxHeight);
    
    if (typeof minWidth === 'number' && !isNaN(minWidth)) {
      width = Math.max(width, minWidth);
    }
    if (typeof maxWidthParsed === 'number' && !isNaN(maxWidthParsed)) {
      width = Math.min(width, maxWidthParsed);
    }
    
    if (aspectRatio && (style.height === 'auto' || style.height === undefined)) {
      const ratio = aspectRatio.width / aspectRatio.height;
      height = width / ratio;
    }
    
    if (typeof minHeight === 'number' && !isNaN(minHeight)) {
      height = Math.max(height, minHeight);
    }
    if (typeof maxHeightParsed === 'number' && !isNaN(maxHeightParsed)) {
      height = Math.min(height, maxHeightParsed);
    }
    
    if (aspectRatio && (style.width === 'auto' || style.width === undefined)) {
      const ratio = aspectRatio.width / aspectRatio.height;
      width = height * ratio;
    }

    let relX = 0, relY = 0;
    
    // Support inset shorthand property
    let top, right, bottom, left;
    
    if (style.inset && style.inset !== 'auto') {
      const insetParts = style.inset.split(/\s+/);
      if (insetParts.length === 1) {
        top = right = bottom = left = this.parseLength(insetParts[0], maxWidth);
      } else if (insetParts.length === 2) {
        top = bottom = this.parseLength(insetParts[0], maxHeight);
        right = left = this.parseLength(insetParts[1], maxWidth);
      } else if (insetParts.length === 3) {
        top = this.parseLength(insetParts[0], maxHeight);
        right = left = this.parseLength(insetParts[1], maxWidth);
        bottom = this.parseLength(insetParts[2], maxHeight);
      } else {
        top = this.parseLength(insetParts[0], maxHeight);
        right = this.parseLength(insetParts[1], maxWidth);
        bottom = this.parseLength(insetParts[2], maxHeight);
        left = this.parseLength(insetParts[3], maxWidth);
      }
    }
    
    // Apply individual properties with priority
    if (style.top !== 'auto') top = this.parseLength(style.top, maxHeight);
    if (style.right !== 'auto') right = this.parseLength(style.right, maxWidth);
    if (style.bottom !== 'auto') bottom = this.parseLength(style.bottom, maxHeight);
    if (style.left !== 'auto') left = this.parseLength(style.left, maxWidth);
    
    if (style.position === 'relative' || style.position === 'sticky' || style.position === 'absolute' || style.position === 'fixed') {
      if (typeof left === 'number') relX = left;
      if (typeof top === 'number') relY = top;
    }

    if (style.position === 'sticky') {
      if (typeof top === 'number') {
        relY = Math.max(relY, top);
      }
    }

    if (style.display === 'flex') {
      this.layoutFlexbox(node, x, y, maxWidth, maxHeight, margin, padding, border);
      return;
    }

    if (style.display === 'grid') {
      this.layoutGrid(node, x, y, maxWidth, maxHeight, margin, padding, border);
      return;
    }

    if (style.display === 'column' || style.columnCount !== 'auto' || style.columnWidth !== 'auto') {
      this.layoutMultiColumn(node, x, y, maxWidth, maxHeight, margin, padding, border);
      return;
    }

    if (style.display === 'table') {
      this.layoutTable(node, x, y, maxWidth, maxHeight, margin, padding, border);
      return;
    }

    if (style.display === 'table-row-group' || style.display === 'table-header-group' || style.display === 'table-footer-group') {
      this.layoutTableSection(node, x, y, maxWidth, maxHeight);
      return;
    }

    if (style.display === 'table-row') {
      this.layoutTableRow(node, x, y, maxWidth, maxHeight);
      return;
    }

    if (style.display === 'table-cell') {
      this.layoutTableCell(node, x, y, maxWidth, maxHeight);
      return;
    }

    if (style.display === 'table-caption') {
      this.layoutTableCaption(node, x, y, maxWidth, maxHeight);
      return;
    }

    if (maxWidth <= 0) maxWidth = 800;
    if (maxHeight <= 0) maxHeight = 600;
    if (isNaN(maxWidth) || !isFinite(maxWidth)) maxWidth = 800;
    if (isNaN(maxHeight) || !isFinite(maxHeight)) maxHeight = 600;

    const outerWidth = Math.max(0, width + margin.left + margin.right + border.left + border.right + padding.left + padding.right);
    const outerHeight = Math.max(0, height + margin.top + margin.bottom + border.top + border.bottom + padding.top + padding.bottom);

    const finalX = Math.max(0, x + margin.left + border.left + padding.left + relX);
    const finalY = Math.max(0, y + margin.top + border.top + padding.top + relY);
    const finalWidth = Math.max(0, width);
    const finalHeight = Math.max(0, height);

    const transform = this.parseTransform(style.transform);
    const transformOrigin = this.parseTransformOrigin(style.transformOrigin);
    const opacity = parseFloat(style.opacity) !== undefined ? parseFloat(style.opacity) : 1;

    node.jscsslayout = {
      x: isNaN(finalX) ? 0 : finalX,
      y: isNaN(finalY) ? 0 : finalY,
      width: isNaN(finalWidth) ? 0 : finalWidth,
      height: isNaN(finalHeight) ? 0 : finalHeight,
      margin: margin,
      padding: padding,
      border: border,
      _outerWidth: isNaN(outerWidth) ? 0 : outerWidth,
      _outerHeight: isNaN(outerHeight) ? 0 : outerHeight,
      opacity: opacity,
      transform: transform,
      transformOrigin: transformOrigin
    };

    let contentX = x + margin.left + border.left + padding.left + relX;
    let contentY = y + margin.top + border.top + padding.top + relY;
    let contentWidth = width;
    let contentHeight = height;

    if (node.type === 'text') {
      const parentStyle = node.parent?.computedStyle || style;
      const metrics = this.measureText(node.content, parentStyle);
      width = metrics.width;
      height = metrics.height;
      node.jscsslayout.width = width;
      node.jscsslayout.height = height;
      return;
    }

    const children = this.getVisibleChildren(node);
    let floatOffset = 0;
    let currentX = contentX;
    let currentY = contentY;
    let lineStartX = contentX;
    let lineHeight = this.parseLength(style.lineHeight, maxHeight) || this.fontSize * 1.2;
    let blockChildren = [];
    let floatChildren = [];
    let inlineChildren = [];

    for (let child of children) {
      const childStyle = child.computedStyle || {};
      if (childStyle.display === 'none') continue;

      if (childStyle.float !== 'none') {
        floatChildren.push(child);
        continue;
      }

      if (childStyle.display === 'block' || childStyle.position !== 'static') {
        blockChildren.push(child);
      } else {
        inlineChildren.push(child);
      }
    }

    let floatLeftWidth = 0;
    let floatRightWidth = 0;
    for (let floatChild of floatChildren) {
      const floatStyle = floatChild.computedStyle || {};
      const floatMargin = this.parseBoxShorthand(floatStyle);
      this.layoutNode(floatChild, currentX, currentY, contentWidth, contentHeight, containingBlock || node);
      const floatW = floatChild.jscsslayout._outerWidth || floatChild.jscsslayout.width;
      if (floatStyle.float === 'left') {
        floatLeftWidth += floatW + floatMargin.left + floatMargin.right;
        if (floatLeftWidth > contentWidth) floatLeftWidth = contentWidth;
      } else {
        floatRightWidth += floatW + floatMargin.left + floatMargin.right;
        if (floatRightWidth > contentWidth) floatRightWidth = contentWidth;
      }
    }

    currentX = contentX + floatLeftWidth;
    let maxChildHeight = 0;

    for (let i = 0; i < inlineChildren.length; i++) {
      const child = inlineChildren[i];
      this.layoutNode(child, currentX, currentY, contentWidth - (currentX - contentX), contentHeight, containingBlock || node);
      const childW = child.jscsslayout._outerWidth || child.jscsslayout.width;
      const childH = child.jscsslayout._outerHeight || child.jscsslayout.height;

      if (currentX + childW > contentX + floatLeftWidth + contentWidth - floatRightWidth) {
        currentX = lineStartX + floatLeftWidth;
        currentY += maxChildHeight;
        maxChildHeight = 0;
      }

      child.jscsslayout.x += floatLeftWidth;
      currentX += childW;
      maxChildHeight = Math.max(maxChildHeight, childH);
    }

    let previousChild = null;
    for (let i = 0; i < blockChildren.length; i++) {
      const blockChild = blockChildren[i];
      const blockStyle = blockChild.computedStyle || {};
      if (blockStyle.position === 'absolute') {
        this.layoutNode(blockChild, contentX, contentY, contentWidth, contentHeight, node);
        continue;
      }
      if (blockStyle.position === 'fixed') {
        this.layoutNode(blockChild, 0, 0, maxWidth, maxHeight, node);
        continue;
      }
      
      let childY = currentY;
      
      // Apply margin collapse between previous child and current child
      if (previousChild !== null) {
        const prevStyle = previousChild.computedStyle || {};
        const currStyle = blockChild.computedStyle || {};
        
        const prevMargin = this.parseBoxShorthand(prevStyle);
        const currMargin = this.parseBoxShorthand(currStyle);
        
        const prevBottom = prevMargin.bottom || 0;
        const currTop = currMargin.top || 0;
        
        if (this.isCollapsibleElement(previousChild) && this.isCollapsibleElement(blockChild)) {
          const collapsedMargin = this.calculateCollapsedMargin(prevBottom, currTop);
          childY = currentY - prevBottom + collapsedMargin;
        }
      }
      
      // Apply margin collapse on current child's top margin
      if (blockChild._collapsedMargins && blockChild._collapsedMargins.top !== undefined) {
        const collapsedTop = blockChild._collapsedMargins.top;
        const childMargin = this.parseBoxShorthand(blockStyle);
        childY = currentY - (childMargin.top || 0) + collapsedTop;
      }
      
      this.layoutNode(blockChild, lineStartX, childY, contentWidth, contentHeight, containingBlock || node);
      currentY += blockChild.jscsslayout._outerHeight || blockChild.jscsslayout.height;
      maxChildHeight = 0;
      previousChild = blockChild;
    }

    if (style.display === 'block' && style.height === 'auto' && height === 'auto') {
      const computedHeight = currentY - contentY;
      node.jscsslayout.height = Math.max(height, computedHeight);
    }
  }

  layoutFlexbox(node, x, y, maxWidth, maxHeight, margin, padding, border) {
    this.layoutFlexboxWithOrder(node, x, y, maxWidth, maxHeight, margin, padding, border);
  }

  layoutFlexboxWithOrder(node, x, y, maxWidth, maxHeight, margin, padding, border) {
    const style = node.computedStyle || {};
    const flexContainer = node._flexContainer || {};
    const dir = flexContainer.direction || 'row';
    const wrap = flexContainer.wrap || 'nowrap';
    const justify = flexContainer.justifyContent || 'flex-start';
    const alignItems = flexContainer.alignItems || 'stretch';
    const alignContent = flexContainer.alignContent || 'stretch';
    const gap = flexContainer.gap || 0;
    const columnGap = flexContainer.columnGap || 0;
    const rowGap = flexContainer.rowGap || 0;

    const children = this.getVisibleChildren(node).filter(c => {
      const s = c.computedStyle || {};
      return s.display !== 'none' && s.display !== 'inline';
    });

    children.sort((a, b) => {
      const orderA = parseInt(a.computedStyle?.order) || 0;
      const orderB = parseInt(b.computedStyle?.order) || 0;
      return orderA - orderB;
    });

    const finalMaxWidth = Math.max(0, maxWidth) || 800;
    const finalMaxHeight = Math.max(0, maxHeight) || 600;

    node.jscsslayout = {
      x: Math.max(0, x + (margin?.left || 0) + (border?.left || 0) + (padding?.left || 0)),
      y: Math.max(0, y + (margin?.top || 0) + (border?.top || 0) + (padding?.top || 0)),
      width: Math.max(0, finalMaxWidth),
      height: Math.max(0, finalMaxHeight),
      margin: margin,
      padding: padding,
      border: border,
      _outerWidth: Math.max(0, finalMaxWidth + (margin?.left || 0) + (margin?.right || 0) + (border?.left || 0) + (border?.right || 0) + (padding?.left || 0) + (padding?.right || 0)),
      _outerHeight: Math.max(0, finalMaxHeight + (margin?.top || 0) + (margin?.bottom || 0) + (border?.top || 0) + (border?.bottom || 0) + (padding?.top || 0) + (padding?.bottom || 0))
    };

    const contentX = x + (margin?.left || 0) + (border?.left || 0) + (padding?.left || 0);
    const contentY = y + (margin?.top || 0) + (border?.top || 0) + (padding?.top || 0);
    const contentWidth = finalMaxWidth;
    const contentHeight = finalMaxHeight;

    const isColumn = dir === 'column' || dir === 'column-reverse';
    const isRow = !isColumn;

    let currentX = contentX;
    let currentY = contentY;
    const rows = [[]];

    for (let child of children) {
      const childStyle = child.computedStyle || {};
      const childMargin = this.parseBoxShorthand(childStyle);
      const grow = parseFloat(childStyle.flexGrow) || 0;
      const shrink = parseFloat(childStyle.flexShrink) || 1;
      const flexBasis = childStyle.flexBasis;
      const childWidth = this.parseLength(childStyle.width, contentWidth);
      const childHeight = this.parseLength(childStyle.height, contentHeight);
      const alignSelf = childStyle.alignSelf || alignItems;

      let itemWidth = childWidth;
      let itemHeight = childHeight;
      
      if (flexBasis && flexBasis !== 'auto') {
        const parsedBasis = this.parseLength(flexBasis, isColumn ? contentHeight : contentWidth);
        if (isRow && itemWidth === 'auto') {
          itemWidth = parsedBasis;
        } else if (!isColumn && itemHeight === 'auto') {
          itemHeight = parsedBasis;
        }
      }
      
      if (itemWidth === 'auto' || itemWidth === undefined) {
        itemWidth = 100;
      }
      if (itemHeight === 'auto' || itemHeight === undefined) {
        itemHeight = 100;
      }

      const outerChildWidth = Math.max(0, itemWidth + (childMargin.left || 0) + (childMargin.right || 0));
      const outerChildHeight = Math.max(0, itemHeight + (childMargin.top || 0) + (childMargin.bottom || 0));

      const mainAxisSize = isRow ? outerChildWidth : outerChildHeight;
      const crossAxisSize = isRow ? outerChildHeight : outerChildWidth;

      if (wrap === 'wrap' && isRow && currentX + outerChildWidth > contentX + contentWidth && rows[rows.length - 1].length > 0) {
        rows.push([]);
        currentX = contentX;
        currentY += (rows[rows.length - 2].reduce((max, item) => Math.max(max, isRow ? item.outerHeight : item.outerWidth), 0)) + (rowGap || 0);
      } else if (wrap === 'wrap' && isColumn && currentY + outerChildHeight > contentY + contentHeight && rows[rows.length - 1].length > 0) {
        rows.push([]);
        currentY = contentY;
        currentX += (rows[rows.length - 2].reduce((max, item) => Math.max(max, isRow ? item.outerWidth : item.outerHeight), 0)) + (columnGap || 0);
      }

      rows[rows.length - 1].push({
        node: child,
        width: itemWidth,
        height: itemHeight,
        margin: childMargin,
        outerWidth: outerChildWidth,
        outerHeight: outerChildHeight,
        grow,
        shrink,
        flexBasis,
        alignSelf
      });

      if (isRow) {
        currentX += outerChildWidth + (columnGap || 0);
      } else {
        currentY += outerChildHeight + (rowGap || 0);
      }
    }

    for (const row of rows) {
      if (row.length === 0) continue;
      
      const totalGrow = row.reduce((sum, item) => sum + item.grow, 0);
      const totalShrink = row.reduce((sum, item) => sum + item.shrink, 0);
      
      const rowMainSize = row.reduce((sum, item, idx) => {
        const gap = (idx > 0 ? (isRow ? columnGap : rowGap) : 0);
        return sum + (isRow ? item.outerWidth : item.outerHeight) + gap;
      }, 0);
      
      const availableMain = (isRow ? contentWidth : contentHeight) - rowMainSize;
      
      if (totalGrow > 0 && availableMain > 0) {
        const flexGrowUnit = availableMain / totalGrow;
        for (const item of row) {
          if (item.grow > 0) {
            const growth = item.grow * flexGrowUnit;
            if (isRow) {
              item.width += growth;
              item.outerWidth += growth;
            } else {
              item.height += growth;
              item.outerHeight += growth;
            }
          }
        }
      } else if (totalShrink > 0 && availableMain < 0) {
        const flexShrinkUnit = Math.abs(availableMain) / totalShrink;
        for (const item of row) {
          if (item.shrink > 0) {
            const shrinkage = item.shrink * flexShrinkUnit;
            if (isRow) {
              item.width = Math.max(0, item.width - shrinkage);
              item.outerWidth = item.width + item.margin.left + item.margin.right;
            } else {
              item.height = Math.max(0, item.height - shrinkage);
              item.outerHeight = item.height + item.margin.top + item.margin.bottom;
            }
          }
        }
      }
    }

    let yPos = contentY;
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (row.length === 0) continue;
      
      let xPos = contentX;
      const rowHeight = Math.max(...row.map(item => item.outerHeight));
      const totalRowWidth = row.reduce((sum, item, idx) => sum + item.outerWidth + (idx > 0 ? columnGap : 0), 0);
      const freeSpace = Math.max(0, contentWidth - totalRowWidth);
      
      if (justify === 'center') {
        xPos = contentX + freeSpace / 2;
      } else if (justify === 'flex-end') {
        xPos = contentX + freeSpace;
      } else if (justify === 'space-between' && row.length > 1) {
        const spaceBetween = freeSpace / (row.length - 1);
        let currentX = contentX;
        for (let i = 0; i < row.length; i++) {
          row[i]._calculatedX = currentX;
          currentX += row[i].outerWidth + spaceBetween;
        }
      } else if (justify === 'space-around' && row.length > 0) {
        const spaceAround = freeSpace / (row.length * 2);
        let currentX = contentX + spaceAround;
        for (let i = 0; i < row.length; i++) {
          row[i]._calculatedX = currentX;
          currentX += row[i].outerWidth + spaceAround * 2;
        }
      } else if (justify === 'space-evenly' && row.length > 0) {
        const spaceEvenly = freeSpace / (row.length + 1);
        let currentX = contentX + spaceEvenly;
        for (let i = 0; i < row.length; i++) {
          row[i]._calculatedX = currentX;
          currentX += row[i].outerWidth + spaceEvenly;
        }
      }
      
      for (let itemIndex = 0; itemIndex < row.length; itemIndex++) {
        const item = row[itemIndex];
        const child = item.node;
        const childMargin = item.margin;
        
        let itemX;
        if (item._calculatedX !== undefined) {
          itemX = item._calculatedX + childMargin.left;
        } else {
          itemX = xPos + childMargin.left;
        }
        
        let itemY = yPos + childMargin.top;
        let alignY = itemY;
        
        if (item.alignSelf === 'center') {
          alignY = yPos + (rowHeight - item.outerHeight) / 2;
        } else if (item.alignSelf === 'flex-end' || item.alignSelf === 'end') {
          alignY = yPos + rowHeight - item.outerHeight;
        } else if (item.alignSelf === 'stretch') {
          item.height = rowHeight - childMargin.top - childMargin.bottom;
        }
        
        if (!item._calculatedX) {
          xPos += item.outerWidth + columnGap;
        }
        
        this.layoutNode(child, itemX, alignY, item.width, item.height, node);
      }
      
      if (justify !== 'space-between' && justify !== 'space-around' && justify !== 'space-evenly') {
        yPos += rowHeight + rowGap;
      } else {
        yPos += rowHeight + rowGap;
      }
    }
    
    if (rows.length > 1) {
      const totalContentSize = rows.reduce((sum, row, idx) => {
        const rowSize = Math.max(...row.map(item => isRow ? item.outerHeight : item.outerWidth));
        return sum + rowSize + (idx < rows.length - 1 ? (isRow ? rowGap : columnGap) : 0);
      }, 0);
      
      const extraSpace = (isRow ? contentHeight : contentWidth) - totalContentSize;
      
      if (alignContent === 'stretch' && extraSpace > 0) {
        const stretchAmount = extraSpace / rows.length;
        for (const row of rows) {
          const rowHeight = Math.max(...row.map(item => item.outerHeight));
          const rowWidth = Math.max(...row.map(item => item.outerWidth));
          for (const item of row) {
            if (isRow) {
              item.height += stretchAmount;
              item.outerHeight += stretchAmount;
              if (item.node.jscsslayout) {
                item.node.jscsslayout.height += stretchAmount;
              }
            } else {
              item.width += stretchAmount;
              item.outerWidth += stretchAmount;
              if (item.node.jscsslayout) {
                item.node.jscsslayout.width += stretchAmount;
              }
            }
          }
        }
      } else if (alignContent === 'center') {
        const offset = extraSpace / 2;
        for (const row of rows) {
          for (const item of row) {
            if (item.node.jscsslayout) {
              if (isRow) {
                item.node.jscsslayout.y += offset;
              } else {
                item.node.jscsslayout.x += offset;
              }
            }
          }
        }
      } else if (alignContent === 'flex-end') {
        for (const row of rows) {
          for (const item of row) {
            if (item.node.jscsslayout) {
              if (isRow) {
                item.node.jscsslayout.y += extraSpace;
              } else {
                item.node.jscsslayout.x += extraSpace;
              }
            }
          }
        }
      } else if (alignContent === 'flex-start') {
        // flex-start is the default behavior, nothing to do
      } else if (alignContent === 'space-between' && rows.length > 1) {
        const spaceBetween = extraSpace / (rows.length - 1);
        let offset = 0;
        for (let i = 0; i < rows.length; i++) {
          if (i > 0) offset += spaceBetween;
          for (const item of rows[i]) {
            if (item.node.jscsslayout) {
              if (isRow) {
                item.node.jscsslayout.y += offset;
              } else {
                item.node.jscsslayout.x += offset;
              }
            }
          }
        }
      } else if (alignContent === 'space-around' && rows.length > 0) {
        const spaceAround = extraSpace / (rows.length * 2);
        let offset = spaceAround;
        for (let i = 0; i < rows.length; i++) {
          if (i > 0) offset += spaceAround * 2;
          for (const item of rows[i]) {
            if (item.node.jscsslayout) {
              if (isRow) {
                item.node.jscsslayout.y += offset;
              } else {
                item.node.jscsslayout.x += offset;
              }
            }
          }
        }
      } else if (alignContent === 'space-evenly' && rows.length > 0) {
        const spaceEvenly = extraSpace / (rows.length + 1);
        let offset = spaceEvenly;
        for (let i = 0; i < rows.length; i++) {
          if (i > 0) offset += spaceEvenly;
          for (const item of rows[i]) {
            if (item.node.jscsslayout) {
              if (isRow) {
                item.node.jscsslayout.y += offset;
              } else {
                item.node.jscsslayout.x += offset;
              }
            }
          }
          offset += spaceEvenly;
        }
      }
    }

    if (style.height === 'auto') {
      const totalHeight = rows.reduce((sum, row, idx) => {
        const rowHeight = Math.max(...row.map(item => item.outerHeight));
        return sum + rowHeight + (idx < rows.length - 1 ? rowGap : 0);
      }, 0);
      node.jscsslayout.height = totalHeight;
    }
  }

  layoutGrid(node, x, y, maxWidth, maxHeight, margin, padding, border) {
    const style = node.computedStyle || {};
    const gridContainer = node._gridContainer || { columns: [], rows: [] };
    const gap = this.parseLength(style.gap || '0', maxWidth) || 0;
    const gridGap = this.parseLength(style.gridGap || '0', maxWidth) || gap;
    const columnGap = this.parseLength(style.columnGap || '0', maxWidth) || gridGap;
    const rowGap = this.parseLength(style.rowGap || '0', maxWidth) || gridGap;
    const gridAutoFlow = style.gridAutoFlow || 'row';

    const outerWidth = maxWidth + margin.left + margin.right + border.left + border.right + padding.left + padding.right;
    const outerHeight = maxHeight + margin.top + margin.bottom + border.top + border.bottom + padding.top + padding.bottom;

    node.jscsslayout = {
      x: x + margin.left + border.left + padding.left,
      y: y + margin.top + border.top + padding.top,
      width: maxWidth,
      height: maxHeight,
      margin: margin,
      padding: padding,
      border: border,
      _outerWidth: outerWidth,
      _outerHeight: outerHeight
    };

    const contentX = x + margin.left + border.left + padding.left;
    const contentY = y + margin.top + border.top + padding.top;
    const children = this.getVisibleChildren(node);
    
    let columns = gridContainer.columns;
    
    if (Array.isArray(columns) && columns.length > 0 && columns[0].raw) {
      const template = columns[0].raw;
      const isAutoFill = columns[0].isAutoFill;
      const isAutoFit = columns[0].isAutoFit;
      
      if (isAutoFill || isAutoFit) {
        const trackMatch = template.match(/\{REPEAT_(auto-fill|auto-fit)_START\}(.+?)\{REPEAT_END\}/);
        if (trackMatch) {
          const trackDef = trackMatch[2].trim();
          let minTrackSize = 100;
          let maxTrackSize = Infinity;
          let hasMinmax = false;
          let maxType = 'auto';
          let maxValue = null;
          
          const minmaxMatch = trackDef.match(/minmax\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/i);
          if (minmaxMatch) {
            hasMinmax = true;
            const minStr = minmaxMatch[1].trim();
            const maxStr = minmaxMatch[2].trim();
            
            if (minStr === 'min-content') {
              minTrackSize = 50;
            } else if (minStr === 'max-content') {
              minTrackSize = 100;
            } else if (minStr.endsWith('px')) {
              minTrackSize = parseFloat(minStr) || 100;
            } else if (minStr.endsWith('%')) {
              minTrackSize = (parseFloat(minStr) / 100) * maxWidth;
            } else if (minStr.endsWith('fr')) {
              minTrackSize = parseFloat(minStr) * 50;
            }
            
            if (maxStr === 'min-content') {
              maxTrackSize = 100;
              maxType = 'min-content';
              maxValue = 100;
            } else if (maxStr === 'max-content') {
              maxTrackSize = 500;
              maxType = 'max-content';
              maxValue = 500;
            } else if (maxStr === 'auto') {
              maxTrackSize = Infinity;
              maxType = 'auto';
              maxValue = null;
            } else if (maxStr.endsWith('px')) {
              maxTrackSize = parseFloat(maxStr);
              maxType = 'px';
              maxValue = maxTrackSize;
            } else if (maxStr.endsWith('%')) {
              maxTrackSize = (parseFloat(maxStr) / 100) * maxWidth;
              maxType = 'percent';
              maxValue = parseFloat(maxStr);
            } else if (maxStr.endsWith('fr')) {
              maxTrackSize = Infinity;
              maxType = 'fr';
              maxValue = parseFloat(maxStr);
            }
          } else if (trackDef.endsWith('px')) {
            minTrackSize = parseFloat(trackDef) || 100;
            maxTrackSize = minTrackSize;
            maxType = 'px';
            maxValue = minTrackSize;
          } else if (trackDef.endsWith('fr')) {
            minTrackSize = parseFloat(trackDef) * 50;
            maxTrackSize = Infinity;
            maxType = 'fr';
            maxValue = parseFloat(trackDef);
          } else if (trackDef === 'auto') {
            minTrackSize = 50;
            maxTrackSize = Infinity;
            maxType = 'auto';
            maxValue = null;
          } else if (trackDef === 'min-content') {
            minTrackSize = 50;
            maxTrackSize = 100;
            maxType = 'min-content';
            maxValue = null;
          } else if (trackDef === 'max-content') {
            minTrackSize = 100;
            maxTrackSize = 500;
            maxType = 'max-content';
            maxValue = null;
          }
          
          const totalGapForAllTracks = columnGap * Math.max(0, Math.floor(maxWidth / (minTrackSize + columnGap)) - 1);
          const maxPossibleTracks = Math.max(1, Math.floor((maxWidth + columnGap) / (minTrackSize + columnGap)));
          
          let trackCount;
          if (isAutoFill) {
            trackCount = maxPossibleTracks;
          } else {
            trackCount = Math.max(1, Math.min(maxPossibleTracks, children.length));
          }
          
          const itemCount = children.length;
          const fillTrackCount = Math.max(trackCount, itemCount);
          
          columns = [];
          for (let i = 0; i < fillTrackCount; i++) {
            const isEmptyTrack = isAutoFit && i >= itemCount;
            
            if (isEmptyTrack) {
              columns.push({ 
                type: 'px', 
                value: 0, 
                min: null, 
                max: null,
                _isCollapsed: true 
              });
            } else if (hasMinmax && minmaxMatch) {
              if (maxType === 'fr') {
                const frValue = maxValue;
                const availableSpace = maxWidth - columnGap * (fillTrackCount - 1);
                const frSpace = availableSpace / (frValue * fillTrackCount);
                columns.push({ 
                  type: 'fr', 
                  value: frValue, 
                  min: { value: minTrackSize, unit: 'px' }, 
                  max: { value: frValue, unit: 'fr', calculated: frSpace * frValue } 
                });
              } else if (maxType === 'auto' || maxType === 'min-content') {
                columns.push({ 
                  type: 'minmax', 
                  min: { value: minTrackSize, unit: 'px' }, 
                  max: { value: maxValue, unit: maxType } 
                });
              } else {
                columns.push({ 
                  type: 'minmax', 
                  min: { value: minTrackSize, unit: 'px' }, 
                  max: { value: maxValue, unit: maxType } 
                });
              }
            } else if (trackDef.endsWith('fr')) {
              columns.push({ 
                type: 'fr', 
                value: parseFloat(trackDef), 
                min: null, 
                max: null,
                _isAuto: true 
              });
            } else if (trackDef.endsWith('px')) {
              columns.push({ 
                type: 'px', 
                value: parseFloat(trackDef), 
                min: null, 
                max: null 
              });
            } else if (trackDef.endsWith('%')) {
              columns.push({ 
                type: 'percent', 
                value: parseFloat(trackDef), 
                min: null, 
                max: null 
              });
            } else {
              columns.push({ 
                type: 'auto', 
                value: null, 
                min: null, 
                max: null,
                _isAuto: true 
              });
            }
          }
          
          node.jscsslayout._gridTrackCount = fillTrackCount;
          node.jscsslayout._gridAutoType = isAutoFit ? 'fit' : 'fill';
          node.jscsslayout._gridAutoFitCollapsed = isAutoFit;
        }
      }
    } else if (!columns || columns.length === 0) {
      columns = [{ type: 'auto', value: null, min: null, max: null }, { type: 'auto', value: null, min: null, max: null }];
    }

    const totalFr = columns.filter(c => c.type === 'fr').reduce((sum, c) => sum + c.value, 0);
    const totalPercent = columns.filter(c => c.type === 'percent').reduce((sum, c) => sum + c.value, 0);
    const fixedWidth = columns.filter(c => c.type === 'px').reduce((sum, c) => sum + c.value, 0);
    const autoAndMinmaxCount = columns.filter(c => c.type === 'auto' || c.type === 'min-content' || c.type === 'max-content' || c.type === 'minmax').length;
    
    const percentWidthTotal = (totalPercent / 100) * maxWidth;
    const availableForFrAndAuto = Math.max(0, maxWidth - fixedWidth - percentWidthTotal - columnGap * (columns.length - 1));
    
    const frUnit = totalFr > 0 ? availableForFrAndAuto / totalFr : 0;
    const autoWidth = autoAndMinmaxCount > 0 ? Math.max(0, availableForFrAndAuto / autoAndMinmaxCount) : 100;

    const colWidths = columns.map((c, index) => {
      if (c.type === 'fr') {
        if (c._isAuto && columns.length > 0) {
          return Math.max(0, availableForFrAndAuto / columns.filter(x => x._isAuto).length);
        }
        if (c.max && c.max.calculated) {
          return Math.max(c.min?.value || 0, c.max.calculated);
        }
        return Math.max(0, c.value * frUnit);
      }
      if (c.type === 'px') {
        return c.value;
      }
      if (c.type === 'percent') {
        return (c.value / 100) * maxWidth;
      }
      if (c.type === 'minmax') {
        let minWidth = c.min.value || 0;
        if (c.min.unit === 'fr') {
          minWidth = c.min.value * frUnit;
        } else if (c.min.unit === 'percent') {
          minWidth = (c.min.value / 100) * maxWidth;
        }
        
        let maxWidthCalc = c.max.value;
        let maxType = c.max.unit;
        let calculatedMax;
        
        if (maxType === 'auto' || maxType === null) {
          calculatedMax = autoWidth;
        } else if (maxType === 'fr') {
          calculatedMax = maxWidthCalc * frUnit;
        } else if (maxType === 'percent') {
          calculatedMax = (maxWidthCalc / 100) * maxWidth;
        } else if (maxType === 'px') {
          calculatedMax = maxWidthCalc;
        } else {
          calculatedMax = autoWidth;
        }
        
        return Math.max(minWidth, calculatedMax);
      }
      if (c.type === 'min-content') {
        return 100;
      }
      if (c.type === 'max-content') {
        return 200;
      }
      if (c._isAuto) {
        return autoWidth;
      }
      return autoWidth;
    });

    let currentX = contentX;
    let currentY = contentY;
    let itemsInRow = 0;

    for (let child of children) {
      const childStyle = child.computedStyle || {};
      const childMargin = this.parseBoxShorthand(childStyle);
      const gridColumn = childStyle.gridColumn || 'auto';
      const gridRow = childStyle.gridRow || 'auto';
      const gridArea = childStyle.gridArea || 'auto';

      let colSpan = 1;

      const spanMatch = gridColumn.match(/span\s*(\d+)/i);
      if (spanMatch) colSpan = parseInt(spanMatch[1]);

      const itemWidth = colWidths.slice(0, Math.min(colSpan, columns.length)).reduce((a, b) => a + b, 0) + (colSpan - 1) * columnGap;
      const itemHeight = 80;

      if (itemsInRow > 0 && currentX + itemWidth > contentX + maxWidth && gridAutoFlow === 'row') {
        currentX = contentX;
        currentY += itemHeight + rowGap;
        itemsInRow = 0;
      }

      this.layoutNode(child, currentX + childMargin.left, currentY + childMargin.top, Math.max(0, itemWidth - childMargin.left - childMargin.right), Math.max(0, itemHeight - childMargin.top - childMargin.bottom), node);

      currentX += itemWidth + columnGap;
      itemsInRow++;
    }

    let totalHeight = currentY - contentY + 80;
    if (style.height === 'auto') {
      node.jscsslayout.height = totalHeight;
    }
  }

  layoutMultiColumn(node, x, y, maxWidth, maxHeight, margin, padding, border) {
    const style = node.computedStyle || {};
    
    const columnCountAttr = style.columnCount;
    const columnCount = columnCountAttr && columnCountAttr !== 'auto' ? parseInt(columnCountAttr) : 'auto';
    const columnWidthAttr = style.columnWidth;
    const columnWidth = columnWidthAttr && columnWidthAttr !== 'auto' ? this.parseLength(columnWidthAttr, maxWidth) : null;
    const columnGap = this.parseLength(style.columnGap, maxWidth) || 20;
    const columnRuleWidth = this.parseLength(style.columnRuleWidth, maxWidth) || 0;
    const columnRuleStyle = style.columnRuleStyle || 'none';
    const columnRuleColor = style.columnRuleColor || 'currentColor';
    const columnFill = style.columnFill || 'balance';
    const orphans = parseInt(style.orphans) || 2;
    const widows = parseInt(style.widows) || 2;

    const outerWidth = maxWidth + margin.left + margin.right + border.left + border.right + padding.left + padding.right;
    const outerHeight = maxHeight + margin.top + margin.bottom + border.top + border.bottom + padding.top + padding.bottom;

    node.jscsslayout = {
      x: x + margin.left + border.left + padding.left,
      y: y + margin.top + border.top + padding.top,
      width: maxWidth,
      height: maxHeight,
      margin: margin,
      padding: padding,
      border: border,
      _outerWidth: outerWidth,
      _outerHeight: outerHeight,
      _columnRuleStyle: columnRuleStyle,
      _columnRuleWidth: columnRuleWidth,
      _columnRuleColor: columnRuleColor,
      _columnFill: columnFill,
      _orphans: orphans,
      _widows: widows
    };

    const contentX = x + margin.left + border.left + padding.left;
    const contentY = y + margin.top + border.top + padding.top;
    const contentWidth = maxWidth;
    const contentHeight = maxHeight;

    let numColumns;
    if (columnCount !== 'auto') {
      numColumns = Math.max(1, columnCount);
    } else if (columnWidth && columnWidth > 0) {
      const columnAndGap = columnWidth + columnGap;
      numColumns = Math.floor((contentWidth + columnGap) / columnAndGap);
      numColumns = Math.max(1, numColumns);
    } else {
      numColumns = 1;
    }

    const totalGaps = columnGap * (numColumns - 1);
    const totalRules = columnRuleStyle !== 'none' && columnRuleWidth > 0 ? columnRuleWidth * (numColumns - 1) : 0;
    const availableWidth = contentWidth - totalGaps - totalRules;
    const columnWidthValue = Math.max(0, availableWidth / numColumns);

    const children = this.getVisibleChildren(node);
    
    const columns = [];
    for (let i = 0; i < numColumns; i++) {
      columns.push({
        items: [],
        height: 0,
        x: contentX + i * (columnWidthValue + columnGap) + (i > 0 ? columnRuleWidth * i : 0)
      });
    }

    let currentColumn = 0;

    for (let child of children) {
      const childStyle = child.computedStyle || {};
      const childMargin = this.parseBoxShorthand(childStyle);
      
      const colSpan = childStyle.columnSpan;
      const breakBefore = childStyle.breakBefore || 'auto';
      const breakAfter = childStyle.breakAfter || 'auto';
      const breakInside = childStyle.breakInside || 'auto';
      
      if (breakBefore === 'column' || breakBefore === 'page' || breakBefore === 'always') {
        currentColumn = numColumns - 1;
      }

      const isSpanning = colSpan === 'all' || (typeof colSpan === 'number' && colSpan >= numColumns);
      
      if (isSpanning) {
        const minHeight = 80;
        const spanX = contentX;
        const spanWidth = contentWidth;
        
        this.layoutNode(child, spanX, contentY + this.getMaxColumnHeight(columns), spanWidth, minHeight, node);
        
        const spanHeight = child.jscsslayout._outerHeight || child.jscsslayout.height;
        
        for (let i = 0; i < numColumns; i++) {
          columns[i].items.push({ node: child, height: spanHeight, isSpanning: true, x: spanX, y: contentY + columns[i].height });
          columns[i].height += spanHeight;
        }
        
        currentColumn = 0;
        
        if (breakAfter === 'column' || breakAfter === 'page' || breakAfter === 'always') {
          currentColumn = numColumns - 1;
        }
        
        continue;
      }

      if (breakInside === 'avoid' || breakInside === 'avoid-column') {
        const childHeight = this.estimateChildHeight(child, columnWidthValue);
        const remainingSpace = contentHeight - columns[currentColumn].height;
        
        if (remainingSpace < childHeight && currentColumn < numColumns - 1) {
          currentColumn++;
        }
      }

      const itemWidth = Math.max(0, columnWidthValue - childMargin.left - childMargin.right);
      
      let targetColumn = currentColumn;
      if (columnFill === 'balance') {
        targetColumn = this.findBestColumnForBalance(columns);
      }

      const itemX = columns[targetColumn].x + childMargin.left;
      const itemY = contentY + columns[targetColumn].height + childMargin.top;

      this.layoutNode(child, itemX, itemY, itemWidth, maxHeight, node);

      const itemHeight = child.jscsslayout._outerHeight || child.jscsslayout.height;
      
      columns[targetColumn].items.push({ 
        node: child, 
        height: itemHeight, 
        isSpanning: false, 
        x: itemX, 
        y: itemY 
      });
      columns[targetColumn].height += itemHeight + childMargin.bottom;

      currentColumn = (targetColumn + 1) % numColumns;
      
      if (breakAfter === 'column' || breakAfter === 'page' || breakAfter === 'always') {
        currentColumn = numColumns - 1;
      }
    }

    if (columnFill === 'balance' || columnFill === 'balance-all') {
      this.balanceColumns(columns, orphans, widows);
    }

    const totalHeight = contentY + this.getMaxColumnHeight(columns);
    node.jscsslayout._columnCount = numColumns;
    node.jscsslayout._columnWidth = columnWidthValue;
    node.jscsslayout._columns = columns;
    
    if (style.height === 'auto') {
      node.jscsslayout.height = Math.max(0, totalHeight - contentY);
    }
  }

  getMaxColumnHeight(columns) {
    return Math.max(...columns.map(col => col.height));
  }

  estimateChildHeight(child, width) {
    const childStyle = child.computedStyle || {};
    const childHeight = this.parseLength(childStyle.height, 800);
    
    if (childHeight && childHeight !== 'auto') {
      return childHeight;
    }
    
    const lineHeight = this.parseLength(childStyle.lineHeight, 800) || 20;
    const estimatedLines = Math.max(1, Math.ceil(width / 50));
    
    return lineHeight * estimatedLines;
  }

  findBestColumnForBalance(columns) {
    const minHeight = Math.min(...columns.map(col => col.height));
    const candidates = columns.map((col, idx) => ({ idx, height: col.height }))
                             .filter(c => c.height === minHeight);
    
    return candidates[0].idx;
  }

  balanceColumns(columns, orphans, widows) {
    const maxColHeight = this.getMaxColumnHeight(columns);
    
    for (let i = 0; i < columns.length - 1; i++) {
      while (columns[i].height > maxColHeight * 0.95) {
        const lastItem = columns[i].items[columns[i].items.length - 1];
        if (!lastItem || lastItem.isSpanning) break;
        
        const nextCol = columns[i + 1];
        
        if (nextCol.items.length < widows || nextCol.items.length === 0) {
          nextCol.items.unshift(lastItem);
          nextCol.height += lastItem.height;
          columns[i].items.pop();
          columns[i].height -= lastItem.height;
        } else {
          break;
        }
      }
    }
    
    for (let i = columns.length - 1; i > 0; i--) {
      if (columns[i].items.length < orphans && columns[i - 1].items.length > orphans) {
        const numToMove = orphans - columns[i].items.length;
        for (let j = 0; j < numToMove && columns[i - 1].items.length > orphans; j++) {
          const item = columns[i - 1].items.pop();
          columns[i].items.unshift(item);
          columns[i].height += item.height;
          columns[i - 1].height -= item.height;
        }
      }
    }
  }

  resolveAbsolutePosition(node) {
    if (node.type === 'element' && node.computedStyle.position === 'absolute') {
      let containingBlock = node.containingBlock;
      while (containingBlock && containingBlock.computedStyle.position === 'static') {
        containingBlock = containingBlock.containingBlock;
      }
      if (containingBlock && containingBlock.jscsslayout) {
        const style = node.computedStyle || {};
        const layout = node.jscsslayout;
        const cbLayout = containingBlock.jscsslayout;

        let newX = cbLayout.x;
        let newY = cbLayout.y;
        let top, right, bottom, left;

        // Support inset shorthand property
        if (style.inset && style.inset !== 'auto') {
          const insetParts = style.inset.split(/\s+/);
          if (insetParts.length === 1) {
            top = right = bottom = left = this.parseLength(insetParts[0], cbLayout.width);
          } else if (insetParts.length === 2) {
            top = bottom = this.parseLength(insetParts[0], cbLayout.height);
            right = left = this.parseLength(insetParts[1], cbLayout.width);
          } else if (insetParts.length === 3) {
            top = this.parseLength(insetParts[0], cbLayout.height);
            right = left = this.parseLength(insetParts[1], cbLayout.width);
            bottom = this.parseLength(insetParts[2], cbLayout.height);
          } else {
            top = this.parseLength(insetParts[0], cbLayout.height);
            right = this.parseLength(insetParts[1], cbLayout.width);
            bottom = this.parseLength(insetParts[2], cbLayout.height);
            left = this.parseLength(insetParts[3], cbLayout.width);
          }
        }

        // Apply individual properties with priority
        if (style.top !== 'auto') top = this.parseLength(style.top, cbLayout.height);
        if (style.right !== 'auto') right = this.parseLength(style.right, cbLayout.width);
        if (style.bottom !== 'auto') bottom = this.parseLength(style.bottom, cbLayout.height);
        if (style.left !== 'auto') left = this.parseLength(style.left, cbLayout.width);

        if (typeof left === 'number') {
          newX += left;
        } else if (typeof right === 'number') {
          newX = cbLayout.x + cbLayout.width - layout._outerWidth - right;
        }

        if (typeof top === 'number') {
          newY += top;
        } else if (typeof bottom === 'number') {
          newY = cbLayout.y + cbLayout.height - layout._outerHeight - bottom;
        }

        node.jscsslayout.x = newX;
        node.jscsslayout.y = newY;
      }
    }
    if (node.children) {
      for (let child of node.children) {
        this.resolveAbsolutePosition(child);
      }
    }
  }

  applyZIndex(node) {
    if (node.children) {
      const positioned = node.children.filter(c =>
        c.type === 'element' && c.computedStyle.position !== 'static'
      );
      positioned.sort((a, b) => {
        const za = this.parseLength(a.computedStyle.zIndex, 1000) || 0;
        const zb = this.parseLength(b.computedStyle.zIndex, 1000) || 0;
        return za - zb;
      });
    }
  }

  getVisibleChildren(node) {
    if (!node.children) return [];
    return node.children.filter(child => {
      if (child.type !== 'element') return true;
      const style = child.computedStyle || {};
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  measureText(text, style) {
    const fontSize = this.parseLength(style.fontSize, 100) || this.fontSize;
    const lineHeight = this.parseLength(style.lineHeight, 100) || fontSize * 1.2;
    const avgCharWidth = fontSize * 0.6;
    return {
      width: text.length * avgCharWidth,
      height: lineHeight
    };
  }

  resolveWidth(node, maxWidth, margin, padding, border) {
    const style = node.computedStyle || {};
    const marginLeft = margin?.left || 0;
    const marginRight = margin?.right || 0;
    const borderLeft = border?.left || 0;
    const borderRight = border?.right || 0;
    const paddingLeft = padding?.left || 0;
    const paddingRight = padding?.right || 0;

    let result = 100;

    if (style.display === 'inline' || style.display === 'inline-block') {
      if (style.width === 'auto' || !style.width) {
        if (node.type === 'text') {
          const metrics = this.measureText(node.content, style);
          result = Math.max(0, metrics.width);
        } else {
          result = 50;
        }
      } else {
        const parsed = this.parseLength(style.width, maxWidth);
        if (typeof parsed === 'number' && !isNaN(parsed) && isFinite(parsed)) {
          result = Math.max(0, parsed);
        }
      }
    } else if (style.display === 'flex' || style.display === 'grid') {
      if (style.width === 'auto' || !style.width) {
        result = Math.max(0, maxWidth);
      } else {
        const parsed = this.parseLength(style.width, maxWidth);
        if (typeof parsed === 'number' && !isNaN(parsed) && isFinite(parsed)) {
          result = Math.max(0, parsed);
        }
      }
    } else if (style.width !== 'auto' && style.width) {
      const parsed = this.parseLength(style.width, maxWidth);
      if (typeof parsed === 'number' && !isNaN(parsed) && isFinite(parsed)) {
        result = Math.max(0, parsed);
      }
    } else if (style.display === 'block') {
      result = maxWidth - marginLeft - marginRight - borderLeft - borderRight - paddingLeft - paddingRight;
      result = Math.max(0, result);
    }

    // Apply min-width and max-width constraints
    const minWidth = this.parseLength(style.minWidth, maxWidth);
    const maxWidthParsed = this.parseLength(style.maxWidth, maxWidth);
    
    if (typeof minWidth === 'number' && !isNaN(minWidth) && isFinite(minWidth)) {
      result = Math.max(result, minWidth);
    }
    
    if (typeof maxWidthParsed === 'number' && !isNaN(maxWidthParsed) && isFinite(maxWidthParsed)) {
      result = Math.min(result, maxWidthParsed);
    }

    return Math.max(0, result);
  }
  
  parseAspectRatio(aspectRatio) {
    if (!aspectRatio || aspectRatio === 'auto') {
      return null;
    }
    
    const parts = aspectRatio.split('/');
    if (parts.length === 1) {
      const val = parseFloat(aspectRatio);
      if (!isNaN(val) && isFinite(val)) {
        return { width: val, height: 1 };
      }
    } else if (parts.length === 2) {
      const width = parseFloat(parts[0].trim());
      const height = parseFloat(parts[1].trim());
      if (!isNaN(width) && isFinite(width) && !isNaN(height) && isFinite(height) && height !== 0) {
        return { width, height };
      }
    }
    
    return null;
  }
  
  calculateContentWidth(node, maxWidth) {
    if (!node.children || node.children.length === 0) {
      return 0;
    }
    
    let maxChildWidth = 0;
    const style = node.computedStyle || {};
    const padding = this.parseBoxShorthand(style, 'padding');
    const border = this.parseBoxShorthand(style, 'border');
    
    for (const child of node.children) {
      if (child.type !== 'element') continue;
      if (child.computedStyle?.display === 'none') continue;
      
      const childStyle = child.computedStyle || {};
      const childMargin = this.parseBoxShorthand(childStyle);
      const childWidth = this.parseLength(childStyle.width, maxWidth) || 0;
      const childOuterWidth = childWidth + 
        (childMargin?.left || 0) + (childMargin?.right || 0);
      
      maxChildWidth = Math.max(maxChildWidth, childOuterWidth);
    }
    
    return maxChildWidth + (padding?.left || 0) + (padding?.right || 0) + 
           (border?.left || 0) + (border?.right || 0);
  }
  
  calculateContentHeight(node, maxHeight) {
    if (!node.children || node.children.length === 0) {
      return 0;
    }
    
    let totalHeight = 0;
    const style = node.computedStyle || {};
    const padding = this.parseBoxShorthand(style, 'padding');
    const border = this.parseBoxShorthand(style, 'border');
    const gap = this.parseLength(style.gap, maxHeight) || 0;
    
    for (const child of node.children) {
      if (child.type !== 'element') continue;
      if (child.computedStyle?.display === 'none') continue;
      
      const childStyle = child.computedStyle || {};
      const childMargin = this.parseBoxShorthand(childStyle);
      const childHeight = this.parseLength(childStyle.height, maxHeight) || 0;
      const childOuterHeight = childHeight + 
        (childMargin?.top || 0) + (childMargin?.bottom || 0);
      
      totalHeight += childOuterHeight + gap;
    }
    
    if (totalHeight > 0 && gap > 0) {
      totalHeight -= gap;
    }
    
    return totalHeight + (padding?.top || 0) + (padding?.bottom || 0) + 
           (border?.top || 0) + (border?.bottom || 0);
  }

  resolveHeight(node, maxHeight, margin, padding, border) {
    const style = node.computedStyle || {};
    const marginTop = margin?.top || 0;
    const marginBottom = margin?.bottom || 0;
    const borderTop = border?.top || 0;
    const borderBottom = border?.bottom || 0;
    const paddingTop = padding?.top || 0;
    const paddingBottom = padding?.bottom || 0;

    let result = 50;

    if (style.display === 'inline' || style.display === 'inline-block') {
      if (style.height === 'auto' || !style.height) {
        const fontSize = this.parseLength(style.fontSize, 100) || this.fontSize;
        const lineHeight = this.parseLength(style.lineHeight, 100) || fontSize * 1.2;
        result = Math.max(0, lineHeight);
      } else {
        const parsed = this.parseLength(style.height, maxHeight);
        if (typeof parsed === 'number' && !isNaN(parsed) && isFinite(parsed)) {
          result = Math.max(0, parsed);
        }
      }
    } else if (style.height !== 'auto' && style.height) {
      const parsed = this.parseLength(style.height, maxHeight);
      if (typeof parsed === 'number' && !isNaN(parsed) && isFinite(parsed)) {
        result = Math.max(0, parsed);
      }
    } else if (style.display === 'block') {
      const fontSize = this.parseLength(style.fontSize, 100) || this.fontSize;
      const lineHeight = this.parseLength(style.lineHeight, 100) || fontSize * 1.2;
      result = Math.max(0, lineHeight);
    }

    // Apply min-height and max-height constraints
    const minHeight = this.parseLength(style.minHeight, maxHeight);
    const maxHeightParsed = this.parseLength(style.maxHeight, maxHeight);
    
    if (typeof minHeight === 'number' && !isNaN(minHeight) && isFinite(minHeight)) {
      result = Math.max(result, minHeight);
    }
    
    if (typeof maxHeightParsed === 'number' && !isNaN(maxHeightParsed) && isFinite(maxHeightParsed)) {
      result = Math.min(result, maxHeightParsed);
    }

    return Math.max(0, result);
  }

  parseBoxShorthand(style, type = 'margin') {
    let value = style[type] || '0';
    if (type === 'margin') {
      value = style.margin || '0';
    } else if (type === 'padding') {
      value = style.padding || '0';
    } else if (type === 'border') {
      const bw = style.borderWidth;
      const useWidth = bw && bw !== '0' && bw !== 0;
      return {
        top: useWidth ? this.parseLength(bw, 100) : this.parseLength(style.borderTopWidth || '0', 100),
        right: useWidth ? this.parseLength(bw, 100) : this.parseLength(style.borderRightWidth || '0', 100),
        bottom: useWidth ? this.parseLength(bw, 100) : this.parseLength(style.borderBottomWidth || '0', 100),
        left: useWidth ? this.parseLength(bw, 100) : this.parseLength(style.borderLeftWidth || '0', 100)
      };
    }
    let parts = value.split(/\s+/);
    let result = { top: 0, right: 0, bottom: 0, left: 0 };
    if (parts.length === 1) {
      const v = this.parseLength(parts[0], 100);
      result.top = result.right = result.bottom = result.left = v;
    } else if (parts.length === 2) {
      result.top = result.bottom = this.parseLength(parts[0], 100);
      result.left = result.right = this.parseLength(parts[1], 100);
    } else if (parts.length === 3) {
      result.top = this.parseLength(parts[0], 100);
      result.left = result.right = this.parseLength(parts[1], 100);
      result.bottom = this.parseLength(parts[2], 100);
    } else if (parts.length >= 4) {
      result.top = this.parseLength(parts[0], 100);
      result.right = this.parseLength(parts[1], 100);
      result.bottom = this.parseLength(parts[2], 100);
      result.left = this.parseLength(parts[3], 100);
    }
    return result;
  }

  parseCalc(value, containerWidth) {
    if (!value || typeof value !== 'string') return 'auto';
    const calcMatch = value.match(/calc\(([^)]+)\)/i);
    if (!calcMatch) return 'auto';
    let expr = calcMatch[1].trim();
    expr = expr.replace(/(\d+(?:\.\d+)?)([a-z%]+)/gi, (match, num, unit) => {
      const parsed = this.parseLength(num + unit, containerWidth);
      return parsed === 'auto' ? match : parsed;
    });
    try {
      const result = Function('"use strict";return (' + expr + ')')();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return result;
      }
    } catch (e) {}
    return 'auto';
  }

  parseMinMaxClamp(value, containerWidth) {
    if (!value || typeof value !== 'string') return 'auto';
    const minMatch = value.match(/min\(([^)]+)\)/i);
    if (minMatch) {
      const parts = minMatch[1].split(',').map(p => p.trim());
      const nums = parts.map(p => this.parseLength(p, containerWidth)).filter(n => typeof n === 'number');
      if (nums.length > 0) return Math.min(...nums);
    }
    const maxMatch = value.match(/max\(([^)]+)\)/i);
    if (maxMatch) {
      const parts = maxMatch[1].split(',').map(p => p.trim());
      const nums = parts.map(p => this.parseLength(p, containerWidth)).filter(n => typeof n === 'number');
      if (nums.length > 0) return Math.max(...nums);
    }
    const clampMatch = value.match(/clamp\(([^)]+)\)/i);
    if (clampMatch) {
      const parts = clampMatch[1].split(',').map(p => p.trim());
      const nums = parts.map(p => this.parseLength(p, containerWidth)).filter(n => typeof n === 'number');
      if (nums.length >= 3) return Math.max(nums[0], Math.min(nums[1], nums[2]));
    }
    return 'auto';
  }

  parseLength(value, containerWidth) {
    if (value === undefined || value === null || value === 'auto' || value === 'normal') return 'auto';
    if (typeof value === 'number') return value;
    const calcResult = this.parseCalc(value, containerWidth);
    if (calcResult !== 'auto') return calcResult;
    const funcResult = this.parseMinMaxClamp(value, containerWidth);
    if (funcResult !== 'auto') return funcResult;
    const pxMatch = value.match(/^(-?\d+(?:\.\d+)?)px$/);
    if (pxMatch) return parseFloat(pxMatch[1]);
    const percentMatch = value.match(/^(-?\d+(?:\.\d+)?)%$/);
    if (percentMatch) return (parseFloat(percentMatch[1]) / 100) * containerWidth;
    const emMatch = value.match(/^(-?\d+(?:\.\d+)?)em$/);
    if (emMatch) return parseFloat(emMatch[1]) * this.fontSize;
    const remMatch = value.match(/^(-?\d+(?:\.\d+)?)rem$/);
    if (remMatch) return parseFloat(remMatch[1]) * this.fontSize;
    const vhMatch = value.match(/^(-?\d+(?:\.\d+)?)vh$/);
    if (vhMatch) return (parseFloat(vhMatch[1]) / 100) * 600;
    const vwMatch = value.match(/^(-?\d+(?:\.\d+)?)vw$/);
    if (vwMatch) return (parseFloat(vwMatch[1]) / 100) * 800;
    const vminMatch = value.match(/^(-?\d+(?:\.\d+)?)vmin$/);
    if (vminMatch) return (parseFloat(vminMatch[1]) / 100) * Math.min(600, 800);
    const vmaxMatch = value.match(/^(-?\d+(?:\.\d+)?)vmax$/);
    if (vmaxMatch) return (parseFloat(vmaxMatch[1]) / 100) * Math.max(600, 800);
    const chMatch = value.match(/^(-?\d+(?:\.\d+)?)ch$/);
    if (chMatch) return parseFloat(chMatch[1]) * this.fontSize * 0.5;
    const exMatch = value.match(/^(-?\d+(?:\.\d+)?)ex$/);
    if (exMatch) return parseFloat(exMatch[1]) * this.fontSize * 0.5;
    const numMatch = value.match(/^(-?\d+(?:\.\d+)?)$/);
    if (numMatch) return parseFloat(numMatch[1]);
    return 'auto';
  }

  parseTransform(transformStr) {
    if (!transformStr || transformStr === 'none') return null;
    
    const result = {
      translateX: 0,
      translateY: 0,
      translateZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      rotateX: 0,
      rotateY: 0,
      rotateZ: 0,
      skewX: 0,
      skewY: 0,
      matrix: null,
      matrix3d: null,
      perspective: 0,
      rotate3dAxis: null,
      rotate3dAngle: 0,
      scale3dValues: null
    };
    
    const functions = transformStr.match(/(\w+)\s*\([^)]+\)/gi) || [];
    
    for (const func of functions) {
      const funcName = func.match(/^(\w+)/)[1].toLowerCase();
      const argsStr = func.match(/\(([^)]+)\)/)[1];
      const args = argsStr.split(',').map(p => p.trim());
      
      switch (funcName) {
        case 'translate':
          result.translateX = this.parseLength(args[0], 100) || 0;
          result.translateY = args[1] ? (this.parseLength(args[1], 100) || 0) : 0;
          result.translateZ = args[2] ? (this.parseLength(args[2], 100) || 0) : 0;
          break;
          
        case 'translatex':
          result.translateX = this.parseLength(args[0], 100) || 0;
          break;
          
        case 'translatey':
          result.translateY = this.parseLength(args[0], 100) || 0;
          break;
          
        case 'translatez':
          result.translateZ = this.parseLength(args[0], 100) || 0;
          break;
          
        case 'translate3d':
          result.translateX = this.parseLength(args[0], 100) || 0;
          result.translateY = this.parseLength(args[1], 100) || 0;
          result.translateZ = this.parseLength(args[2], 100) || 0;
          break;
          
        case 'scale':
          result.scaleX = parseFloat(args[0]) || 1;
          result.scaleY = args[1] !== undefined ? (parseFloat(args[1]) || 1) : result.scaleX;
          result.scaleZ = args[2] !== undefined ? (parseFloat(args[2]) || 1) : 1;
          break;
          
        case 'scalex':
          result.scaleX = parseFloat(args[0]) || 1;
          break;
          
        case 'scaley':
          result.scaleY = parseFloat(args[0]) || 1;
          break;
          
        case 'scalez':
          result.scaleZ = parseFloat(args[0]) || 1;
          break;
          
        case 'scale3d':
          result.scaleX = parseFloat(args[0]) || 1;
          result.scaleY = parseFloat(args[1]) || 1;
          result.scaleZ = parseFloat(args[2]) || 1;
          result.scale3dValues = [result.scaleX, result.scaleY, result.scaleZ];
          break;
          
        case 'rotate':
          result.rotateZ = this._parseAngle(args[0]);
          break;
          
        case 'rotatex':
          result.rotateX = this._parseAngle(args[0]);
          break;
          
        case 'rotatey':
          result.rotateY = this._parseAngle(args[0]);
          break;
          
        case 'rotatez':
          result.rotateZ = this._parseAngle(args[0]);
          break;
          
        case 'rotate3d':
          result.rotate3dAxis = [
            parseFloat(args[0]) || 0,
            parseFloat(args[1]) || 0,
            parseFloat(args[2]) || 0
          ];
          result.rotate3dAngle = this._parseAngle(args[3]);
          break;
          
        case 'skewx':
          result.skewX = this._parseAngle(args[0]);
          break;
          
        case 'skewy':
          result.skewY = this._parseAngle(args[0]);
          break;
          
        case 'skew':
          result.skewX = this._parseAngle(args[0]);
          result.skewY = args[1] !== undefined ? this._parseAngle(args[1]) : 0;
          break;
          
        case 'perspective':
          result.perspective = this.parseLength(args[0], 100) || 0;
          break;
          
        case 'matrix':
          if (args.length >= 6) {
            result.matrix = args.slice(0, 6).map(p => parseFloat(p) || 0);
          }
          break;
          
        case 'matrix3d':
          if (args.length >= 16) {
            result.matrix3d = args.slice(0, 16).map(p => parseFloat(p) || 0);
          }
          break;
      }
    }
    
    return result;
  }

  _parseAngle(angleStr) {
    if (!angleStr) return 0;
    const match = angleStr.match(/(-?\d+(?:\.\d+)?)\s*(deg|rad|grad|turn)?/);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2] || 'deg';
    
    switch (unit.toLowerCase()) {
      case 'rad':
        return value * (180 / Math.PI);
      case 'grad':
        return value * 0.9;
      case 'turn':
        return value * 360;
      default:
        return value;
    }
  }

  computeTransform(node, width, height) {
    const style = node.computedStyle;
    const transformStr = style.transform || 'none';
    const transformOriginStr = style.transformOrigin || '50% 50%';
    
    if (transformStr === 'none') return null;
    
    const transform = this.parseTransform(transformStr);
    const origin = this.parseTransformOrigin(transformOriginStr);
    
    if (!transform) return null;
    
    transform.originX = origin.x * width;
    transform.originY = origin.y * height;
    
    return transform;
  }

  applyTransformToLayout(node, transform, width, height) {
    if (!transform || !node.jscsslayout) return;
    
    const layout = node.jscsslayout;
    const originX = transform.originX || width / 2;
    const originY = transform.originY || height / 2;
    const originZ = transform.originZ || 0;
    
    let x = layout.x;
    let y = layout.y;
    let transformedWidth = layout.width;
    let transformedHeight = layout.height;
    
    if (transform.translateX) {
      x += transform.translateX;
    }
    if (transform.translateY) {
      y += transform.translateY;
    }
    
    if (transform.scaleX !== 1 || transform.scaleY !== 1 || transform.scaleZ !== 1) {
      const effectiveScaleX = transform.scaleX * (transform.scaleZ || 1);
      const effectiveScaleY = transform.scaleY * (transform.scaleZ || 1);
      x = originX + (x - originX) * effectiveScaleX;
      y = originY + (y - originY) * effectiveScaleY;
      transformedWidth = layout.width * effectiveScaleX;
      transformedHeight = layout.height * effectiveScaleY;
    }
    
    const hasRotation = transform.rotateX !== 0 || transform.rotateY !== 0 || transform.rotateZ !== 0;
    const hasSkew = transform.skewX !== 0 || transform.skewY !== 0;
    
    const transformMatrix = this._computeTransformMatrix(transform, width, height);
    
    layout._transform = transform;
    layout._transformedX = x;
    layout._transformedY = y;
    layout._transformedWidth = transformedWidth;
    layout._transformedHeight = transformedHeight;
    layout._transformMatrix = transformMatrix;
    layout._hasRotation = hasRotation;
    layout._hasSkew = hasSkew;
    layout._is3D = transform.translateZ !== 0 || transform.scaleZ !== 1 || 
                   transform.rotateX !== 0 || transform.rotateY !== 0 || 
                   transform.perspective !== 0 || transform.rotate3dAxis !== null;
    
    return layout;
  }

  _computeTransformMatrix(transform, width, height) {
    const originX = transform.originX || width / 2;
    const originY = transform.originY || height / 2;
    
    let matrix = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
    
    if (transform.translateX || transform.translateY || transform.translateZ) {
      matrix = this._multiplyMatrices(matrix, this._translateMatrix(
        transform.translateX || 0,
        transform.translateY || 0,
        transform.translateZ || 0
      ));
    }
    
    if (transform.scaleX !== 1 || transform.scaleY !== 1 || transform.scaleZ !== 1) {
      matrix = this._multiplyMatrices(matrix, this._scaleMatrix(
        transform.scaleX,
        transform.scaleY,
        transform.scaleZ
      ));
    }
    
    if (transform.skewX !== 0) {
      matrix = this._multiplyMatrices(matrix, this._skewXMatrix(transform.skewX));
    }
    
    if (transform.skewY !== 0) {
      matrix = this._multiplyMatrices(matrix, this._skewYMatrix(transform.skewY));
    }
    
    if (transform.rotateZ !== 0) {
      matrix = this._multiplyMatrices(matrix, this._rotateZMatrix(transform.rotateZ));
    }
    
    if (transform.rotateX !== 0) {
      matrix = this._multiplyMatrices(matrix, this._rotateXMatrix(transform.rotateX));
    }
    
    if (transform.rotateY !== 0) {
      matrix = this._multiplyMatrices(matrix, this._rotateYMatrix(transform.rotateY));
    }
    
    if (transform.matrix) {
      matrix = this._multiplyMatrices(matrix, this._matrixTo3D(transform.matrix));
    }
    
    if (transform.matrix3d) {
      matrix = this._multiplyMatrices(matrix, this._arrayToMatrix(transform.matrix3d));
    }
    
    return matrix;
  }

  _translateMatrix(tx, ty, tz) {
    return [
      [1, 0, 0, tx],
      [0, 1, 0, ty],
      [0, 0, 1, tz],
      [0, 0, 0, 1]
    ];
  }

  _scaleMatrix(sx, sy, sz) {
    return [
      [sx, 0, 0, 0],
      [0, sy, 0, 0],
      [0, 0, sz, 0],
      [0, 0, 0, 1]
    ];
  }

  _rotateXMatrix(deg) {
    const rad = deg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [
      [1, 0, 0, 0],
      [0, cos, -sin, 0],
      [0, sin, cos, 0],
      [0, 0, 0, 1]
    ];
  }

  _rotateYMatrix(deg) {
    const rad = deg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [
      [cos, 0, sin, 0],
      [0, 1, 0, 0],
      [-sin, 0, cos, 0],
      [0, 0, 0, 1]
    ];
  }

  _rotateZMatrix(deg) {
    const rad = deg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [
      [cos, -sin, 0, 0],
      [sin, cos, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
  }

  _skewXMatrix(deg) {
    const rad = deg * Math.PI / 180;
    const tan = Math.tan(rad);
    return [
      [1, tan, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
  }

  _skewYMatrix(deg) {
    const rad = deg * Math.PI / 180;
    const tan = Math.tan(rad);
    return [
      [1, 0, 0, 0],
      [tan, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
  }

  _matrixTo3D(matrix2d) {
    return [
      [matrix2d[0], matrix2d[2], 0, matrix2d[4]],
      [matrix2d[1], matrix2d[3], 0, matrix2d[5]],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
  }

  _arrayToMatrix(arr) {
    return [
      [arr[0], arr[4], arr[8], arr[12]],
      [arr[1], arr[5], arr[9], arr[13]],
      [arr[2], arr[6], arr[10], arr[14]],
      [arr[3], arr[7], arr[11], arr[15]]
    ];
  }

  _multiplyMatrices(a, b) {
    const result = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        for (let k = 0; k < 4; k++) {
          result[i][j] += a[i][k] * b[k][j];
        }
      }
    }
    return result;
  }

  parseTransformOrigin(originStr) {
    if (!originStr || originStr === '50% 50%') return { x: 0.5, y: 0.5, z: 0 };
    const parts = originStr.split(/\s+/).map(p => p.trim());
    let x = 0.5, y = 0.5, z = 0;
    
    if (parts[0]) {
      if (parts[0] === 'left') x = 0;
      else if (parts[0] === 'right') x = 1;
      else if (parts[0] === 'center') x = 0.5;
      else {
        const parsed = this.parseLength(parts[0], 100);
        if (typeof parsed === 'number') x = parsed / 100;
      }
    }
    
    if (parts[1]) {
      if (parts[1] === 'top') y = 0;
      else if (parts[1] === 'bottom') y = 1;
      else if (parts[1] === 'center') y = 0.5;
      else {
        const parsed = this.parseLength(parts[1], 100);
        if (typeof parsed === 'number') y = parsed / 100;
      }
    }
    
    if (parts[2]) {
      z = this.parseLength(parts[2], 100) || 0;
    }
    
    return { x, y, z };
  }

  layoutTable(node, x, y, maxWidth, maxHeight, margin, padding, border) {
    const style = node.computedStyle || {};
    const collapse = style.borderCollapse === 'collapse';
    const borderSpacing = collapse ? 0 : this.parseLength(style.borderSpacing, maxWidth) || 2;
    const tableLayout = style.tableLayout || 'auto';
    const captionSide = style.captionSide || 'top';
    const emptyCells = style.emptyCells || 'show';

    const outerWidth = maxWidth + margin.left + margin.right + border.left + border.right + padding.left + padding.right;
    const outerHeight = maxHeight + margin.top + margin.bottom + border.top + border.bottom + padding.top + padding.bottom;

    node.jscsslayout = {
      x: x + margin.left + border.left + padding.left,
      y: y + margin.top + border.top + padding.top,
      width: maxWidth,
      height: maxHeight,
      margin: margin,
      padding: padding,
      border: border,
      _outerWidth: outerWidth,
      _outerHeight: outerHeight,
      _borderCollapse: collapse,
      _borderSpacing: borderSpacing,
      _tableLayout: tableLayout,
      _captionSide: captionSide,
      _emptyCells: emptyCells
    };

    const captionNode = node.children?.find(c => c.type === 'element' && c.tagName === 'caption');
    const colgroupNodes = node.children?.filter(c => c.type === 'element' && c.tagName === 'colgroup') || [];
    const theadNode = node.children?.find(c => c.type === 'element' && c.tagName === 'thead');
    const tbodyNodes = node.children?.filter(c => c.type === 'element' && c.tagName === 'tbody') || [];
    const tfootNode = node.children?.find(c => c.type === 'element' && c.tagName === 'tfoot');

    const allRows = [];
    if (theadNode) {
      allRows.push(...this.getTableRows(theadNode));
    }
    for (const tbody of tbodyNodes) {
      allRows.push(...this.getTableRows(tbody));
    }
    if (tfootNode) {
      allRows.push(...this.getTableRows(tfootNode));
    }

    const colCount = this.getMaxColCount(allRows);
    const colWidths = this.calculateColumnWidths(allRows, colCount, maxWidth, tableLayout, colgroupNodes);

    let currentY = y + margin.top + border.top + padding.top;
    const tableContentX = x + margin.left + border.left + padding.left;

    if (captionNode && captionSide !== 'bottom') {
      const captionHeight = this.layoutTableCaption(captionNode, tableContentX, currentY, maxWidth);
      currentY += captionHeight + borderSpacing;
    }

    const tableInnerY = currentY;
    const tableInnerHeight = maxHeight - (currentY - (y + margin.top + border.top + padding.top));
    const tableInnerWidth = maxWidth;

    if (theadNode) {
      this.layoutTableSection(theadNode, tableContentX, currentY, tableInnerWidth, tableInnerHeight, colWidths, borderSpacing, collapse);
      currentY += this.getSectionHeight(theadNode) + borderSpacing;
    }

    for (const tbody of tbodyNodes) {
      this.layoutTableSection(tbody, tableContentX, currentY, tableInnerWidth, tableInnerHeight, colWidths, borderSpacing, collapse);
      currentY += this.getSectionHeight(tbody) + borderSpacing;
    }

    if (tfootNode) {
      this.layoutTableSection(tfootNode, tableContentX, currentY, tableInnerWidth, tableInnerHeight, colWidths, borderSpacing, collapse);
      currentY += this.getSectionHeight(tfootNode) + borderSpacing;
    }

    if (captionNode && captionSide === 'bottom') {
      const captionHeight = this.layoutTableCaption(captionNode, tableContentX, currentY, maxWidth);
      currentY += captionHeight;
    }

    if (style.height === 'auto') {
      node.jscsslayout.height = currentY - (y + margin.top + border.top + padding.top);
    }

    node._colWidths = colWidths;
    node._tableInnerX = tableContentX;
    node._tableInnerY = tableInnerY;
    node._totalRowHeight = currentY - tableInnerY;
  }

  getTableRows(sectionNode) {
    if (!sectionNode.children) return [];
    return sectionNode.children
      .filter(c => c.type === 'element' && c.tagName === 'tr')
      .map(tr => ({
        node: tr,
        cells: tr.children?.filter(c => c.type === 'element' && (c.tagName === 'td' || c.tagName === 'th')) || []
      }));
  }

  getMaxColCount(rows) {
    let max = 0;
    for (const row of rows) {
      let colspan = 0;
      for (const cell of row.cells) {
        const span = parseInt(cell.attributes.colspan) || 1;
        colspan += span;
      }
      max = Math.max(max, colspan);
    }
    return max || 1;
  }

  calculateColumnWidths(rows, colCount, tableWidth, tableLayout, colgroupNodes) {
    const colWidths = new Array(colCount).fill(50);
    const minWidths = new Array(colCount).fill(1);
    const maxWidths = new Array(colCount).fill(Infinity);
    const hasExplicitWidth = new Array(colCount).fill(false);

    for (const colgroupNode of colgroupNodes) {
      if (colgroupNode.children) {
        let colIndex = 0;
        for (const col of colgroupNode.children) {
          if (col.type === 'element' && col.tagName === 'col') {
            const span = parseInt(col.attributes.span) || 1;
            const style = col.computedStyle || {};
            const width = this.parseLength(style.width, tableWidth);
            
            if (width > 0 && width !== 'auto') {
              const avgWidth = width / span;
              for (let i = 0; i < span && colIndex + i < colCount; i++) {
                colWidths[colIndex + i] = avgWidth;
                minWidths[colIndex + i] = Math.max(minWidths[colIndex + i], avgWidth);
                maxWidths[colIndex + i] = Math.min(maxWidths[colIndex + i], avgWidth);
                hasExplicitWidth[colIndex + i] = true;
              }
            }
            
            const minWidth = this.parseLength(style.minWidth, tableWidth);
            if (minWidth > 0) {
              for (let i = 0; i < span && colIndex + i < colCount; i++) {
                minWidths[colIndex + i] = Math.max(minWidths[colIndex + i], minWidth / span);
              }
            }
            
            const maxWidth = this.parseLength(style.maxWidth, tableWidth);
            if (maxWidth > 0) {
              for (let i = 0; i < span && colIndex + i < colCount; i++) {
                maxWidths[colIndex + i] = Math.min(maxWidths[colIndex + i], maxWidth / span);
              }
            }
            
            colIndex += span;
          }
        }
      }
    }

    for (const row of rows) {
      let colIndex = 0;
      for (const cell of row.cells) {
        const span = parseInt(cell.attributes.span) || 1;
        const cellStyle = cell.computedStyle || {};
        const cellWidth = this.parseLength(cellStyle.width, tableWidth);
        
        if (cellWidth > 0 && cellWidth !== 'auto') {
          const avgWidth = cellWidth / span;
          for (let i = 0; i < span && colIndex + i < colCount; i++) {
            if (!hasExplicitWidth[colIndex + i]) {
              minWidths[colIndex + i] = Math.max(minWidths[colIndex + i], avgWidth);
            }
          }
        }
        
        const cellMinWidth = this.parseLength(cellStyle.minWidth, tableWidth);
        if (cellMinWidth > 0) {
          const avgMinWidth = cellMinWidth / span;
          for (let i = 0; i < span && colIndex + i < colCount; i++) {
            minWidths[colIndex + i] = Math.max(minWidths[colIndex + i], avgMinWidth);
          }
        }
        
        const cellMaxWidth = this.parseLength(cellStyle.maxWidth, tableWidth);
        if (cellMaxWidth > 0) {
          const avgMaxWidth = cellMaxWidth / span;
          for (let i = 0; i < span && colIndex + i < colCount; i++) {
            maxWidths[colIndex + i] = Math.min(maxWidths[colIndex + i], avgMaxWidth);
          }
        }
        
        colIndex += span;
      }
    }

    const totalMinWidth = minWidths.reduce((a, b) => a + b, 0);

    if (tableLayout === 'fixed') {
      const explicitCols = hasExplicitWidth.filter(Boolean).length;
      
      if (explicitCols === 0) {
        const equalWidth = tableWidth / colCount;
        return new Array(colCount).fill(equalWidth);
      }
      
      const explicitTotal = colWidths.reduce((sum, w, i) => sum + (hasExplicitWidth[i] ? w : 0), 0);
      const remainingWidth = tableWidth - explicitTotal;
      const implicitCount = colCount - explicitCols;
      
      if (implicitCount > 0 && remainingWidth > 0) {
        const implicitWidth = remainingWidth / implicitCount;
        for (let i = 0; i < colCount; i++) {
          if (!hasExplicitWidth[i]) {
            colWidths[i] = implicitWidth;
          }
        }
      }
      
      return colWidths;
    }

    if (totalMinWidth > tableWidth) {
      const scale = tableWidth / totalMinWidth;
      return minWidths.map((w, i) => Math.min(Math.max(w * scale, minWidths[i]), maxWidths[i]));
    }

    const scale = tableWidth / totalMinWidth;
    for (let i = 0; i < colCount; i++) {
      colWidths[i] = Math.max(minWidths[i], Math.min(minWidths[i] * scale, maxWidths[i]));
    }

    const totalWidth = colWidths.reduce((a, b) => a + b, 0);
    if (totalWidth < tableWidth) {
      const diff = tableWidth - totalWidth;
      const expandableCols = colWidths.map((w, i) => !hasExplicitWidth[i]).filter(Boolean).length;
      
      if (expandableCols > 0) {
        const extraPerCol = diff / expandableCols;
        let remainingDiff = diff;
        for (let i = 0; i < colCount; i++) {
          if (!hasExplicitWidth[i]) {
            const add = Math.min(extraPerCol, remainingDiff);
            colWidths[i] += add;
            remainingDiff -= add;
            if (remainingDiff <= 0) break;
          }
        }
      } else {
        colWidths[colCount - 1] += diff;
      }
    }

    return colWidths;
  }

  layoutTableSection(node, x, y, maxWidth, maxHeight, colWidths, borderSpacing, collapse) {
    if (!node.jscsslayout) node.jscsslayout = {};
    const style = node.computedStyle || {};

    const isHeader = node.tagName === 'thead';
    const isFooter = node.tagName === 'tfoot';
    const displayType = isHeader ? 'table-header-group' : isFooter ? 'table-footer-group' : 'table-row-group';

    node.jscsslayout = {
      x: x,
      y: y,
      width: maxWidth,
      height: 0,
      _displayType: displayType,
      _isHeader: isHeader,
      _isFooter: isFooter
    };

    if (node.children) {
      const rows = node.children.filter(c => c.type === 'element' && c.tagName === 'tr');
      let currentY = y;

      for (const row of rows) {
        this.layoutTableRow(row, x, currentY, maxWidth, maxHeight, colWidths, borderSpacing, collapse);
        currentY += row.jscsslayout._outerHeight || 30;
      }
      node.jscsslayout.height = currentY - y;
    }
  }

  layoutTableRow(node, x, y, maxWidth, maxHeight, colWidths, borderSpacing, collapse) {
    if (!node.jscsslayout) node.jscsslayout = {};
    const style = node.computedStyle || {};

    const rowHeight = this.parseLength(style.height, maxHeight);
    const isHeaderRow = node.parent?.tagName === 'thead';
    const isFooterRow = node.parent?.tagName === 'tfoot';

    node.jscsslayout = {
      x: x,
      y: y,
      width: maxWidth,
      height: 0,
      _isHeaderRow: isHeaderRow,
      _isFooterRow: isFooterRow,
      _hasExplicitHeight: rowHeight > 0 && rowHeight !== 'auto'
    };

    if (!colWidths) {
      const tableNode = this.findAncestor(node, 'table');
      colWidths = tableNode?._colWidths || new Array(10).fill(100);
    }

    if (node.children) {
      const cells = node.children.filter(c => c.type === 'element' && (c.tagName === 'td' || c.tagName === 'th'));
      let currentX = x;
      let maxCellHeight = 0;
      const cellHeights = [];
      let colIndex = 0;

      for (const cell of cells) {
        const colspan = parseInt(cell.attributes.colspan) || 1;
        const rowspan = parseInt(cell.attributes.rowspan) || 1;
        
        const effectiveCols = Math.min(colspan, colWidths.length - colIndex);
        const cellWidth = colWidths.slice(colIndex, colIndex + effectiveCols).reduce((a, b) => a + b, 0);
        
        const cellMaxHeight = rowHeight > 0 ? rowHeight : maxHeight;
        this.layoutTableCell(cell, currentX, y, cellWidth, cellMaxHeight, borderSpacing, collapse, isHeaderRow);
        
        const cellOuterHeight = cell.jscsslayout._outerHeight || 30;
        cellHeights.push(cellOuterHeight);
        
        if (!collapse) {
          currentX += cellWidth + borderSpacing;
        } else {
          currentX += cellWidth;
        }
        
        colIndex += colspan;
      }

      maxCellHeight = rowHeight > 0 ? rowHeight : Math.max(...cellHeights, 30);

      for (const cell of cells) {
        if (cell.jscsslayout.height < maxCellHeight) {
          const cellStyle = cell.computedStyle || {};
          const vAlign = cellStyle.verticalAlign || (isHeaderRow ? 'middle' : 'baseline');
          const outerHeight = cell.jscsslayout._outerHeight || cell.jscsslayout.height;
          const extraHeight = maxCellHeight - outerHeight;
          
          if (vAlign === 'middle') {
            cell.jscsslayout.y += extraHeight / 2;
          } else if (vAlign === 'bottom') {
            cell.jscsslayout.y += extraHeight;
          } else if (vAlign === 'text-bottom') {
            cell.jscsslayout.y += extraHeight;
          } else if (vAlign === 'text-top') {
            cell.jscsslayout.y += 0;
          }
          
          cell.jscsslayout.height = maxCellHeight;
          cell.jscsslayout._outerHeight = maxCellHeight;
        }
      }

      node.jscsslayout.height = maxCellHeight;
      node.jscsslayout._outerHeight = maxCellHeight;
      node._cellHeights = cellHeights;
    }
  }

  layoutTableCell(node, x, y, maxWidth, maxHeight, borderSpacing, collapse, isHeader) {
    if (!node.jscsslayout) node.jscsslayout = {};
    const style = node.computedStyle || {};
    const padding = this.parseBoxShorthand(style, 'padding');
    const border = this.parseBoxShorthand(style, 'border');
    
    const textAlign = style.textAlign || (isHeader ? 'center' : 'left');
    const verticalAlign = style.verticalAlign || (isHeader ? 'middle' : 'baseline');
    const emptyCells = style.emptyCells || 'show';

    const contentWidth = maxWidth - padding.left - padding.right - border.left - border.right;
    const contentHeight = maxHeight - padding.top - padding.bottom - border.top - border.bottom;

    let cellWidth = maxWidth;
    let cellHeight = 30;
    let hasContent = false;

    if (node.children && node.children.length > 0) {
      let contentY = y + padding.top + border.top;
      for (const child of node.children) {
        if (child.type === 'element' && child.computedStyle?.display === 'none') continue;
        
        if (child.type === 'text' && (!child.content || !child.content.trim())) continue;
        
        hasContent = true;
        this.layoutNode(child, x + padding.left + border.left, contentY, contentWidth, contentHeight);
        contentY += child.jscsslayout._outerHeight || child.jscsslayout.height;
        cellHeight = Math.max(cellHeight, contentY - (y + padding.top + border.top));
      }
    } else if (node.type === 'text') {
      hasContent = !!node.content && node.content.trim();
      if (hasContent) {
        const metrics = this.measureText(node.content, style);
        cellWidth = Math.max(cellWidth, metrics.width + padding.left + padding.right + border.left + border.right);
        cellHeight = metrics.height + padding.top + padding.bottom + border.top + border.bottom;
      }
    }

    if (!hasContent && emptyCells === 'hide') {
      cellWidth = 0;
      cellHeight = 0;
    }

    const outerWidth = cellWidth + padding.left + padding.right + border.left + border.right;
    const outerHeight = cellHeight + padding.top + padding.bottom + border.top + border.bottom;

    node.jscsslayout = {
      x: x + padding.left + border.left,
      y: y + padding.top + border.top,
      width: cellWidth,
      height: cellHeight,
      padding: padding,
      border: border,
      _outerWidth: outerWidth,
      _outerHeight: outerHeight,
      _textAlign: textAlign,
      _verticalAlign: verticalAlign,
      _isHeader: isHeader,
      _hasContent: hasContent,
      _emptyCells: emptyCells
    };

    this.applyTableCellAlignment(node, textAlign, verticalAlign, contentWidth, contentHeight);
  }

  applyTableCellAlignment(node, textAlign, verticalAlign, contentWidth, contentHeight) {
    if (!node.jscsslayout || !node.children) return;

    const layout = node.jscsslayout;
    const cellContentX = layout.x;
    const cellContentY = layout.y;

    for (const child of node.children) {
      if (!child.jscsslayout) continue;
      
      if (textAlign === 'center') {
        const childWidth = child.jscsslayout.width || 0;
        child.jscsslayout.x = cellContentX + (contentWidth - childWidth) / 2;
      } else if (textAlign === 'right') {
        const childWidth = child.jscsslayout.width || 0;
        child.jscsslayout.x = cellContentX + contentWidth - childWidth;
      }

      if (verticalAlign === 'middle') {
        const childHeight = child.jscsslayout.height || 0;
        child.jscsslayout.y = cellContentY + (contentHeight - childHeight) / 2;
      } else if (verticalAlign === 'bottom') {
        const childHeight = child.jscsslayout.height || 0;
        child.jscsslayout.y = cellContentY + contentHeight - childHeight;
      }
    }
  }

  layoutTableCaption(node, x, y, maxWidth) {
    if (!node.jscsslayout) node.jscsslayout = {};
    const style = node.computedStyle || {};
    const padding = this.parseBoxShorthand(style, 'padding');
    const textAlign = style.textAlign || 'center';

    const contentWidth = maxWidth - padding.left - padding.right;
    let contentY = y + padding.top;
    let captionHeight = 20;

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        if (child.type === 'element' && child.computedStyle?.display === 'none') continue;
        this.layoutNode(child, x + padding.left, contentY, contentWidth, 100);
        contentY += child.jscsslayout._outerHeight || child.jscsslayout.height;
        captionHeight = contentY - (y + padding.top);
      }
    } else if (node.type === 'text') {
      const metrics = this.measureText(node.content, style);
      captionHeight = metrics.height + padding.top + padding.bottom;
    }

    node.jscsslayout = {
      x: x + padding.left,
      y: y + padding.top,
      width: contentWidth,
      height: captionHeight,
      _outerWidth: maxWidth,
      _outerHeight: captionHeight + padding.top + padding.bottom
    };
  }

  getSectionHeight(sectionNode) {
    if (!sectionNode.children) return 0;
    let height = 0;
    for (const child of sectionNode.children) {
      if (child.type === 'element' && child.tagName === 'tr') {
        height += child.jscsslayout?._outerHeight || 30;
      }
    }
    return height;
  }

  findAncestor(node, tagName) {
    let current = node;
    while (current) {
      if (current.type === 'element' && current.tagName === tagName) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }
}

module.exports = LayoutEngine;
