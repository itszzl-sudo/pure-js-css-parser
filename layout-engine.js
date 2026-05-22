class LayoutEngine {
  constructor() {
    this.fontSize = 16;
    this.lineHeight = 1.2;
  }

  compute(root, styles) {
    this.collectAllNodes(root);
    this.applyStyles(root, styles);
    this.computeFlexbox(root);
    this.computeGrid(root);
    this.layoutNode(root, 0, 0, 800, 600);
    this.resolveAbsolutePosition(root);
    this.applyZIndex(root);
  }

  collectAllNodes(node, ancestors = []) {
    node.ancestors = [...ancestors];
    if (node.children) {
      for (let child of node.children) {
        this.collectAllNodes(child, [...ancestors, node]);
      }
    }
  }

  applyStyles(node, styles, parent = null) {
    node.computedStyle = { ...this.getDefaultStyle(node) };
    if (node.type === 'element') {
      for (let rule of styles) {
        if (this.matchesSelector(node, rule.selector, parent)) {
          for (let [key, value] of Object.entries(rule.declarations)) {
            node.computedStyle[this.toCamelCase(key)] = value;
          }
        }
      }
      if (node.attributes.style) {
        const styleStr = node.attributes.style;
        styleStr.split(';').forEach(decl => {
          const [prop, value] = decl.split(':');
          if (prop && value) {
            node.computedStyle[this.toCamelCase(prop.trim())] = value.trim();
          }
        });
      }
      this.parseBorderShorthand(node.computedStyle);
      this.computeFontProperties(node);
      this.computeBoxSizing(node);
    }
    if (node.children) {
      for (let child of node.children) {
        child.parent = node;
        this.applyStyles(child, styles, node);
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
      if (sel === node.tagName) return true;
      if (sel.startsWith('.') && node.attributes.class === sel.slice(1)) return true;
      if (sel.startsWith('#') && node.attributes.id === sel.slice(1)) return true;
    }
    return false;
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
      outlineOffset: '0',
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
      animation: 'none'
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
    if (style.boxSizing === 'border-box') {
      style._useBorderBox = true;
    } else {
      style._useBorderBox = false;
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
    return template.split(/\s+/).map(item => {
      if (item.endsWith('fr')) {
        return { type: 'fr', value: parseFloat(item) };
      } else if (item.endsWith('px')) {
        return { type: 'px', value: parseFloat(item) };
      } else if (item === 'auto') {
        return { type: 'auto' };
      } else {
        return { type: 'auto' };
      }
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

    if (style.aspectRatio && style.aspectRatio !== 'auto') {
      const ratioMatch = style.aspectRatio.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
      if (ratioMatch) {
        const ratio = parseFloat(ratioMatch[1]) / parseFloat(ratioMatch[2]);
        if (width !== 'auto' && !isNaN(width)) {
          height = width / ratio;
        } else if (height !== 'auto' && !isNaN(height)) {
          width = height * ratio;
        }
      } else {
        const ratio = parseFloat(style.aspectRatio);
        if (!isNaN(ratio) && width !== 'auto' && !isNaN(width)) {
          height = width / ratio;
        } else if (!isNaN(ratio) && height !== 'auto' && !isNaN(height)) {
          width = height * ratio;
        }
      }
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

    for (let blockChild of blockChildren) {
      const blockStyle = blockChild.computedStyle || {};
      if (blockStyle.position === 'absolute') {
        this.layoutNode(blockChild, contentX, contentY, contentWidth, contentHeight, node);
        continue;
      }
      if (blockStyle.position === 'fixed') {
        this.layoutNode(blockChild, 0, 0, maxWidth, maxHeight, node);
        continue;
      }
      this.layoutNode(blockChild, lineStartX, currentY, contentWidth, contentHeight, containingBlock || node);
      currentY += blockChild.jscsslayout._outerHeight || blockChild.jscsslayout.height;
      maxChildHeight = 0;
    }

    if (style.display === 'block' && style.height === 'auto' && height === 'auto') {
      const computedHeight = currentY - contentY;
      node.jscsslayout.height = Math.max(height, computedHeight);
    }
  }

  layoutFlexbox(node, x, y, maxWidth, maxHeight, margin, padding, border) {
    const style = node.computedStyle || {};
    const flexContainer = node._flexContainer || {};
    const dir = flexContainer.direction || 'row';
    const wrap = flexContainer.wrap || 'nowrap';
    const justify = flexContainer.justifyContent || 'flex-start';
    const alignItems = flexContainer.alignItems || 'stretch';
    const alignContent = flexContainer.alignContent || 'stretch';
    const gap = flexContainer.gap || 0;
    const columnGap = flexContainer.columnGap || gap || 0;
    const rowGap = flexContainer.rowGap || gap || 0;

    const children = this.getVisibleChildren(node).filter(c => {
      const s = c.computedStyle || {};
      return s.display !== 'none' && s.display !== 'inline';
    }).sort((a, b) => {
      const orderA = parseInt(a.computedStyle?.order) || 0;
      const orderB = parseInt(b.computedStyle?.order) || 0;
      return orderA - orderB;
    });

    const finalMaxWidth = Math.max(0, maxWidth) || 800;
    const finalMaxHeight = Math.max(0, maxHeight) || 600;

    const outerWidth = Math.max(0, finalMaxWidth + (margin?.left || 0) + (margin?.right || 0) + (border?.left || 0) + (border?.right || 0) + (padding?.left || 0) + (padding?.right || 0));
    const outerHeight = Math.max(0, finalMaxHeight + (margin?.top || 0) + (margin?.bottom || 0) + (border?.top || 0) + (border?.bottom || 0) + (padding?.top || 0) + (padding?.bottom || 0));

    node.jscsslayout = {
      x: Math.max(0, x + (margin?.left || 0) + (border?.left || 0) + (padding?.left || 0)),
      y: Math.max(0, y + (margin?.top || 0) + (border?.top || 0) + (padding?.top || 0)),
      width: Math.max(0, finalMaxWidth),
      height: Math.max(0, finalMaxHeight),
      margin: margin,
      padding: padding,
      border: border,
      _outerWidth: outerWidth,
      _outerHeight: outerHeight
    };

    const contentX = x + (margin?.left || 0) + (border?.left || 0) + (padding?.left || 0);
    const contentY = y + (margin?.top || 0) + (border?.top || 0) + (padding?.top || 0);
    const contentWidth = finalMaxWidth;
    const contentHeight = finalMaxHeight;

    let totalFlexGrow = 0;
    let totalFlexBasis = 0;
    let totalFlexShrink = 0;

    const childItems = children.map(child => {
      const childStyle = child.computedStyle || {};
      const childMargin = this.parseBoxShorthand(childStyle);
      const grow = parseFloat(childStyle.flexGrow) || 0;
      const shrink = parseFloat(childStyle.flexShrink) || 1;
      const basis = this.parseLength(childStyle.flexBasis, contentWidth);
      let childWidth = this.parseLength(childStyle.width, contentWidth);
      let childHeight = this.parseLength(childStyle.height, contentHeight);
      const alignSelf = childStyle.alignSelf || 'auto';

      if (childStyle.width === 'auto' && (childStyle.flexBasis === 'auto' || !childStyle.flexBasis)) {
        childWidth = 50;
      } else if (childStyle.flexBasis !== 'auto' && childStyle.flexBasis && childStyle.flexBasis !== '0') {
        childWidth = basis || 50;
      }

      if (childHeight === 'auto' || !childHeight) {
        childHeight = 50;
      }

      totalFlexGrow += grow;
      totalFlexShrink += shrink;
      if (basis !== 'auto') {
        totalFlexBasis += (basis || 0) + (childMargin.left || 0) + (childMargin.right || 0);
      } else if (childWidth !== 'auto') {
        totalFlexBasis += (childWidth || 0) + (childMargin.left || 0) + (childMargin.right || 0);
      }

      return {
        node: child,
        width: childWidth,
        height: childHeight,
        margin: childMargin,
        grow,
        shrink,
        basis,
        alignSelf
      };
    });

    const availableWidth = Math.max(0, contentWidth - (totalFlexBasis || 0) - (children.length - 1) * columnGap);
    let unitGrow = totalFlexGrow > 0 && availableWidth > 0 ? availableWidth / totalFlexGrow : 0;

    const rows = [[]];
    let currentRow = rows[0];
    let currentX = contentX;
    let currentY = contentY;
    let rowMaxHeight = 0;

    for (let item of childItems) {
      const childWidth = item.grow > 0 ? (item.width || 0) + unitGrow * item.grow : item.width;
      const outerChildWidth = Math.max(0, (childWidth || 0) + (item.margin.left || 0) + (item.margin.right || 0));
      const outerChildHeight = Math.max(0, (item.height || 0) + (item.margin.top || 0) + (item.margin.bottom || 0));

      if (wrap === 'wrap' && currentRow.length > 0 && currentX + outerChildWidth > contentX + contentWidth) {
        rows.push([]);
        currentRow = rows[rows.length - 1];
        currentX = contentX;
        currentY += rowMaxHeight + rowGap;
        rowMaxHeight = 0;
      }

      item.width = childWidth;
      item.outerWidth = outerChildWidth;
      item.outerHeight = outerChildHeight;
      currentRow.push(item);
      currentX += outerChildWidth + columnGap;
      rowMaxHeight = Math.max(rowMaxHeight, outerChildHeight);
    }

    let yOffset = contentY;
    const totalContentHeight = rows.reduce((sum, row) => {
      const rowHeight = Math.max(...row.map(i => i.outerHeight), 0);
      return sum + rowHeight + (rows.length > 1 ? rowGap : 0);
    }, 0) - (rows.length > 1 ? rowGap : 0);

    if (alignContent === 'center' && rows.length > 1) {
      yOffset += (contentHeight - totalContentHeight) / 2;
    } else if (alignContent === 'flex-end' && rows.length > 1) {
      yOffset += contentHeight - totalContentHeight;
    } else if (alignContent === 'space-between' && rows.length > 1) {
      const extraSpace = contentHeight - totalContentHeight;
      const spacePerGap = rows.length > 1 ? extraSpace / (rows.length - 1) : 0;
      let adjustedY = yOffset;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        row._y = adjustedY;
        const rowHeight = Math.max(...row.map(j => j.outerHeight), 0);
        adjustedY += rowHeight + (i < rows.length - 1 ? rowGap + spacePerGap : 0);
      }
    } else if (alignContent === 'space-around' && rows.length > 1) {
      const extraSpace = contentHeight - totalContentHeight;
      const spacePerSide = rows.length > 0 ? extraSpace / (rows.length * 2) : 0;
      let adjustedY = yOffset + spacePerSide;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        row._y = adjustedY;
        const rowHeight = Math.max(...row.map(j => j.outerHeight), 0);
        adjustedY += rowHeight + rowGap + (i < rows.length - 1 ? spacePerSide * 2 : 0);
      }
    }

    for (const row of rows) {
      const rowHeight = Math.max(...row.map(i => i.outerHeight), 0);
      const rowWidth = row.reduce((sum, item, idx) => sum + item.outerWidth + (idx > 0 ? columnGap : 0), 0);
      let xOffset = contentX;

      if (justify === 'center') {
        xOffset += (contentWidth - rowWidth) / 2;
      } else if (justify === 'flex-end') {
        xOffset += contentWidth - rowWidth;
      } else if (justify === 'space-between' && row.length > 1) {
        const extraSpace = contentWidth - rowWidth;
        const spacePerItem = extraSpace / (row.length - 1);
        let currentOffset = contentX;
        for (let i = 0; i < row.length; i++) {
          const item = row[i];
          item._x = currentOffset;
          currentOffset += item.outerWidth + columnGap + (i < row.length - 1 ? spacePerItem : 0);
        }
      } else if (justify === 'space-around' && row.length > 0) {
        const extraSpace = contentWidth - rowWidth;
        const spacePerSide = extraSpace / (row.length * 2);
        let currentOffset = contentX + spacePerSide;
        for (let i = 0; i < row.length; i++) {
          const item = row[i];
          item._x = currentOffset;
          currentOffset += item.outerWidth + columnGap + spacePerSide * 2;
        }
      } else if (justify === 'space-evenly' && row.length > 0) {
        const extraSpace = contentWidth - rowWidth;
        const spacePerGap = extraSpace / (row.length + 1);
        let currentOffset = contentX + spacePerGap;
        for (let i = 0; i < row.length; i++) {
          const item = row[i];
          item._x = currentOffset;
          currentOffset += item.outerWidth + columnGap + spacePerGap;
        }
      }

      for (const item of row) {
        let itemX = (item._x !== undefined ? item._x : xOffset) + (item.margin.left || 0);
        let itemY = (row._y !== undefined ? row._y : yOffset) + (item.margin.top || 0);
        let finalHeight = item.height;

        const effectiveAlign = item.alignSelf !== 'auto' ? item.alignSelf : alignItems;
        if (effectiveAlign === 'center') {
          itemY = (row._y !== undefined ? row._y : yOffset) + (rowHeight - item.outerHeight) / 2 + (item.margin.top || 0);
        } else if (effectiveAlign === 'flex-end' || effectiveAlign === 'end') {
          itemY = (row._y !== undefined ? row._y : yOffset) + rowHeight - item.outerHeight + (item.margin.top || 0);
        } else if (effectiveAlign === 'stretch' && item.height === 'auto') {
          finalHeight = rowHeight - (item.margin.top || 0) - (item.margin.bottom || 0);
        }

        this.layoutNode(item.node, itemX, itemY, item.width, finalHeight, node);

        if (item._x === undefined) {
          xOffset += item.outerWidth + columnGap;
        }
      }

      if (row._y === undefined) {
        yOffset += rowHeight + rowGap;
      }
    }

    let totalHeight = yOffset - contentY - (rows.length > 1 ? rowGap : 0);
    if (style.height === 'auto') {
      node.jscsslayout.height = Math.max(totalHeight, 0);
    }
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

    let totalFlexGrow = 0;
    let totalFlexBasis = 0;

    for (let child of children) {
      const childStyle = child.computedStyle || {};
      const childMargin = this.parseBoxShorthand(childStyle);
      const grow = parseFloat(childStyle.flexGrow) || 0;
      const basis = this.parseLength(childStyle.flexBasis, contentWidth);
      const childWidth = this.parseLength(childStyle.width, contentWidth);
      totalFlexGrow += grow;
      if (basis === 'auto' && childWidth === 'auto') {
      } else if (basis !== 'auto') {
        totalFlexBasis += (basis || 0) + (childMargin.left || 0) + (childMargin.right || 0);
      } else if (childWidth !== 'auto') {
        totalFlexBasis += (childWidth || 0) + (childMargin.left || 0) + (childMargin.right || 0);
      }
    }

    const availableWidth = Math.max(0, contentWidth - (totalFlexBasis || 0) - (children.length - 1) * (columnGap || 0));
    let unitGrow = totalFlexGrow > 0 && availableWidth > 0 ? availableWidth / totalFlexGrow : 0;

    let currentX = contentX;
    let currentY = contentY;
    let maxRowHeight = 0;
    let rowStartX = contentX;
    let rowMaxHeight = 0;
    const rows = [[]];

    for (let child of children) {
      const childStyle = child.computedStyle || {};
      const childMargin = this.parseBoxShorthand(childStyle);
      const grow = parseFloat(childStyle.flexGrow) || 0;
      const shrink = parseFloat(childStyle.flexShrink) || 1;
      const basis = this.parseLength(childStyle.flexBasis, contentWidth);
      const childWidth = this.parseLength(childStyle.width, contentWidth);
      const childHeight = this.parseLength(childStyle.height, contentHeight);
      const alignSelf = childStyle.alignSelf || alignItems;

      let itemWidth = childWidth;
      if (childStyle.width === 'auto' && (childStyle.flexBasis === 'auto' || !childStyle.flexBasis)) {
        itemWidth = grow > 0 ? Math.max(0, unitGrow) : 50;
      } else if (childStyle.flexBasis !== 'auto' && childStyle.flexBasis && childStyle.flexBasis !== '0') {
        itemWidth = basis || 50;
      }

      let itemHeight = childHeight === 'auto' || !childHeight ? 50 : childHeight;
      if (childStyle.height === 'auto' || !childStyle.height) {
        itemHeight = childStyle.flexBasis !== 'auto' && childStyle.flexBasis ? (basis || 50) : 50;
      }

      const outerChildWidth = Math.max(0, itemWidth + (childMargin.left || 0) + (childMargin.right || 0));
      const outerChildHeight = Math.max(0, itemHeight + (childMargin.top || 0) + (childMargin.bottom || 0));

      if (wrap === 'wrap' && currentX + outerChildWidth > contentX + contentWidth && rows[rows.length - 1].length > 0) {
        rows.push([]);
        currentX = rowStartX;
        currentY += (rowMaxHeight || 0) + (rowGap || 0);
        rowMaxHeight = 0;
      }

      rows[rows.length - 1].push({
        node: child,
        width: itemWidth,
        height: itemHeight,
        margin: childMargin,
        outerWidth: outerChildWidth,
        outerHeight: outerChildHeight,
        alignSelf
      });

      currentX += outerChildWidth + columnGap;
      maxRowHeight = Math.max(maxRowHeight, outerChildHeight);
      rowMaxHeight = Math.max(rowMaxHeight, outerChildHeight);
    }

    let yPos = contentY;
    for (const row of rows) {
      let xPos = contentX;
      const rowHeight = Math.max(...row.map(item => item.outerHeight));

      for (const item of row) {
        const child = item.node;
        const childMargin = item.margin;
        let itemX = xPos + childMargin.left;
        let itemY = yPos + childMargin.top;

        let alignY = itemY;
        if (item.alignSelf === 'center') {
          alignY = yPos + (rowHeight - item.outerHeight) / 2;
        } else if (item.alignSelf === 'flex-end' || item.alignSelf === 'end') {
          alignY = yPos + rowHeight - item.outerHeight;
        } else if (item.alignSelf === 'stretch') {
          item.height = rowHeight - childMargin.top - childMargin.bottom;
        }

        this.layoutNode(child, itemX, alignY, item.width, item.height, node);
        xPos += item.outerWidth + columnGap;
      }

      yPos += rowHeight + rowGap;
    }

    if (style.height === 'auto') {
      node.jscsslayout.height = yPos - contentY;
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

    const columns = gridContainer.columns.length > 0 ? gridContainer.columns : [{ type: 'auto' }, { type: 'auto' }];

    const totalFr = columns.filter(c => c.type === 'fr').reduce((sum, c) => sum + c.value, 0);
    const fixedWidth = columns.filter(c => c.type === 'px').reduce((sum, c) => sum + c.value, 0);
    const autoCount = columns.filter(c => c.type === 'auto').length;
    const frUnit = totalFr > 0 ? Math.max(0, (maxWidth - fixedWidth - columnGap * (columns.length - 1))) / totalFr : 0;
    const autoWidth = autoCount > 0 ? Math.max(0, (maxWidth - fixedWidth - columnGap * (columns.length - 1))) / autoCount : 100;

    const colWidths = columns.map(c => {
      if (c.type === 'fr') return Math.max(0, c.value * frUnit);
      if (c.type === 'px') return c.value;
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
      scaleX: 1,
      scaleY: 1,
      rotate: 0,
      skewX: 0,
      skewY: 0
    };
    const translateMatch = transformStr.match(/translate\(([^)]+)\)/i);
    if (translateMatch) {
      const parts = translateMatch[1].split(',').map(p => p.trim());
      result.translateX = this.parseLength(parts[0], 100) || 0;
      result.translateY = parts[1] ? (this.parseLength(parts[1], 100) || 0) : 0;
    }
    const translateXMatch = transformStr.match(/translateX\(([^)]+)\)/i);
    if (translateXMatch) {
      result.translateX = this.parseLength(translateXMatch[1], 100) || 0;
    }
    const translateYMatch = transformStr.match(/translateY\(([^)]+)\)/i);
    if (translateYMatch) {
      result.translateY = this.parseLength(translateYMatch[1], 100) || 0;
    }
    const scaleMatch = transformStr.match(/scale\(([^)]+)\)/i);
    if (scaleMatch) {
      const parts = scaleMatch[1].split(',').map(p => parseFloat(p.trim()));
      result.scaleX = parts[0] || 1;
      result.scaleY = parts[1] !== undefined ? parts[1] : result.scaleX;
    }
    const rotateMatch = transformStr.match(/rotate\(([^)]+)\)/i);
    if (rotateMatch) {
      const degMatch = rotateMatch[1].match(/(-?\d+(?:\.\d+)?)(deg)?/);
      result.rotate = degMatch ? parseFloat(degMatch[1]) : parseFloat(rotateMatch[1]);
    }
    return result;
  }

  parseTransformOrigin(originStr) {
    if (!originStr || originStr === '50% 50%') return { x: 0.5, y: 0.5 };
    const parts = originStr.split(/\s+/).map(p => p.trim());
    let x = 0.5, y = 0.5;
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
    return { x, y };
  }

  layoutTable(node, x, y, maxWidth, maxHeight, margin, padding, border) {
    const style = node.computedStyle || {};
    const collapse = style.borderCollapse === 'collapse';
    const spacing = collapse ? 0 : this.parseLength(style.borderSpacing, maxWidth) || 0;

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

    const captionNode = node.children?.find(c => c.type === 'element' && c.tagName === 'caption');
    const colgroupNode = node.children?.find(c => c.type === 'element' && c.tagName === 'colgroup');
    const theadNode = node.children?.find(c => c.type === 'element' && c.tagName === 'thead');
    const tbodyNodes = node.children?.filter(c => c.type === 'element' && c.tagName === 'tbody') || [];
    const tfootNode = node.children?.find(c => c.type === 'element' && c.tagName === 'tfoot');

    const rows = [];
    if (theadNode) {
      rows.push(...this.getTableRows(theadNode));
    }
    for (const tbody of tbodyNodes) {
      rows.push(...this.getTableRows(tbody));
    }
    if (tfootNode) {
      rows.push(...this.getTableRows(tfootNode));
    }

    const colCount = this.getMaxColCount(rows);
    const colWidths = this.calculateColumnWidths(rows, colCount, maxWidth, style.tableLayout, colgroupNode);

    let currentY = y + margin.top + border.top + padding.top;
    if (captionNode && style.captionSide !== 'bottom') {
      this.layoutNode(captionNode, x + margin.left + border.left + padding.left, currentY, maxWidth, 20);
      currentY += captionNode.jscsslayout._outerHeight || 20 + spacing;
    }

    const tableInnerY = currentY;
    const tableInnerHeight = maxHeight - (currentY - (y + margin.top + border.top + padding.top));
    const tableInnerWidth = maxWidth;

    if (theadNode) {
      this.layoutTableSection(theadNode, x + margin.left + border.left + padding.left, currentY, tableInnerWidth, tableInnerHeight);
      currentY += this.getSectionHeight(theadNode) + spacing;
    }

    for (const tbody of tbodyNodes) {
      this.layoutTableSection(tbody, x + margin.left + border.left + padding.left, currentY, tableInnerWidth, tableInnerHeight);
      currentY += this.getSectionHeight(tbody) + spacing;
    }

    if (tfootNode) {
      this.layoutTableSection(tfootNode, x + margin.left + border.left + padding.left, currentY, tableInnerWidth, tableInnerHeight);
      currentY += this.getSectionHeight(tfootNode) + spacing;
    }

    if (captionNode && style.captionSide === 'bottom') {
      this.layoutNode(captionNode, x + margin.left + border.left + padding.left, currentY, maxWidth, 20);
      currentY += captionNode.jscsslayout._outerHeight || 20;
    }

    if (style.height === 'auto') {
      node.jscsslayout.height = currentY - (y + margin.top + border.top + padding.top);
    }

    node._colWidths = colWidths;
    node._tableInnerX = x + margin.left + border.left + padding.left;
    node._tableInnerY = tableInnerY;
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

  calculateColumnWidths(rows, colCount, tableWidth, tableLayout, colgroupNode) {
    const colWidths = new Array(colCount).fill(50);
    const minWidths = new Array(colCount).fill(30);
    const maxWidths = new Array(colCount).fill(300);

    if (colgroupNode && colgroupNode.children) {
      let colIndex = 0;
      for (const col of colgroupNode.children) {
        if (col.type === 'element' && col.tagName === 'col') {
          const span = parseInt(col.attributes.span) || 1;
          const style = col.computedStyle || {};
          const width = this.parseLength(style.width, tableWidth);
          if (width > 0 && width !== 'auto') {
            for (let i = 0; i < span && colIndex + i < colCount; i++) {
              colWidths[colIndex + i] = width / span;
              maxWidths[colIndex + i] = width / span;
            }
          }
          colIndex += span;
        }
      }
    }

    for (const row of rows) {
      let colIndex = 0;
      for (const cell of row.cells) {
        const span = parseInt(cell.attributes.colspan) || 1;
        const cellStyle = cell.computedStyle || {};
        const cellWidth = this.parseLength(cellStyle.width, tableWidth);
        if (cellWidth > 0 && cellWidth !== 'auto') {
          const avgWidth = cellWidth / span;
          for (let i = 0; i < span && colIndex + i < colCount; i++) {
            minWidths[colIndex + i] = Math.max(minWidths[colIndex + i], avgWidth);
          }
        }
        colIndex += span;
      }
    }

    const totalMinWidth = minWidths.reduce((a, b) => a + b, 0);
    const totalMaxWidth = maxWidths.reduce((a, b) => a + b, 0);

    if (tableLayout === 'fixed') {
      const fixedWidth = this.parseLength(
        rows[0]?.cells[0]?.computedStyle?.width,
        tableWidth
      );
      if (fixedWidth > 0) {
        return colWidths;
      }
    }

    if (totalMinWidth > tableWidth) {
      return minWidths.map(w => Math.max(w, 30));
    }

    const scale = tableWidth / totalMinWidth;
    for (let i = 0; i < colCount; i++) {
      colWidths[i] = Math.min(minWidths[i] * scale, maxWidths[i]);
    }

    const totalWidth = colWidths.reduce((a, b) => a + b, 0);
    if (totalWidth < tableWidth) {
      const diff = tableWidth - totalWidth;
      colWidths[colCount - 1] += diff;
    }

    return colWidths;
  }

  layoutTableSection(node, x, y, maxWidth, maxHeight) {
    if (!node.jscsslayout) node.jscsslayout = {};
    const style = node.computedStyle || {};

    const isHeader = node.tagName === 'thead';
    const isFooter = node.tagName === 'tfoot';
    const displayType = isHeader ? 'table-header-group' : isFooter ? 'table-footer-group' : 'table-row-group';

    node.jscsslayout = {
      x: x,
      y: y,
      width: maxWidth,
      height: 0
    };

    if (node.children) {
      const rows = node.children.filter(c => c.type === 'element' && c.tagName === 'tr');
      let currentY = y;
      const tableNode = this.findAncestor(node, 'table');

      for (const row of rows) {
        this.layoutTableRow(row, x, currentY, maxWidth, maxHeight);
        currentY += row.jscsslayout._outerHeight || 30;
      }
      node.jscsslayout.height = currentY - y;
    }
  }

  layoutTableRow(node, x, y, maxWidth, maxHeight) {
    if (!node.jscsslayout) node.jscsslayout = {};
    const style = node.computedStyle || {};
    const spacing = this.parseLength(style.borderSpacing, maxWidth) || 0;

    node.jscsslayout = {
      x: x,
      y: y,
      width: maxWidth,
      height: 0
    };

    const tableNode = this.findAncestor(node, 'table');
    const colWidths = tableNode?._colWidths || new Array(10).fill(100);

    if (node.children) {
      const cells = node.children.filter(c => c.type === 'element' && (c.tagName === 'td' || c.tagName === 'th'));
      let currentX = x;
      let maxCellHeight = 0;
      const cellHeights = [];

      for (const cell of cells) {
        const colspan = parseInt(cell.attributes.colspan) || 1;
        const cellWidth = colWidths.slice(0, colspan).reduce((a, b) => a + b, 0);
        this.layoutTableCell(cell, currentX, y, cellWidth, maxHeight);
        cellHeights.push(cell.jscsslayout._outerHeight || 30);
        currentX += cellWidth + spacing;
      }

      maxCellHeight = Math.max(...cellHeights, 30);

      for (const cell of cells) {
        if (cell.jscsslayout.height < maxCellHeight) {
          const style = cell.computedStyle || {};
          const vAlign = style.verticalAlign || 'middle';
          const extraHeight = maxCellHeight - cell.jscsslayout._outerHeight;
          if (vAlign === 'middle') {
            cell.jscsslayout.y += extraHeight / 2;
          } else if (vAlign === 'bottom') {
            cell.jscsslayout.y += extraHeight;
          }
          cell.jscsslayout.height = maxCellHeight;
          cell.jscsslayout._outerHeight = maxCellHeight;
        }
      }

      node.jscsslayout.height = maxCellHeight;
      node.jscsslayout._outerHeight = maxCellHeight;
    }
  }

  layoutTableCell(node, x, y, maxWidth, maxHeight) {
    if (!node.jscsslayout) node.jscsslayout = {};
    const style = node.computedStyle || {};
    const padding = this.parseBoxShorthand(style, 'padding');
    const border = this.parseBoxShorthand(style, 'border');

    const contentWidth = maxWidth - padding.left - padding.right - border.left - border.right;
    const contentHeight = maxHeight - padding.top - padding.bottom - border.top - border.bottom;

    let cellWidth = maxWidth;
    let cellHeight = 30;

    if (node.children && node.children.length > 0) {
      let contentY = y + padding.top + border.top;
      for (const child of node.children) {
        if (child.type === 'element' && child.computedStyle?.display === 'none') continue;
        this.layoutNode(child, x + padding.left + border.left, contentY, contentWidth, contentHeight);
        contentY += child.jscsslayout._outerHeight || child.jscsslayout.height;
        cellHeight = Math.max(cellHeight, contentY - (y + padding.top + border.top));
      }
    } else if (node.type === 'text') {
      const metrics = this.measureText(node.content, style);
      cellWidth = Math.max(cellWidth, metrics.width + padding.left + padding.right + border.left + border.right);
      cellHeight = metrics.height + padding.top + padding.bottom + border.top + border.bottom;
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
      _outerHeight: outerHeight
    };
  }

  layoutTableCaption(node, x, y, maxWidth, maxHeight) {
    if (!node.jscsslayout) node.jscsslayout = {};
    const style = node.computedStyle || {};
    const padding = this.parseBoxShorthand(style, 'padding');

    const contentWidth = maxWidth - padding.left - padding.right;
    let contentY = y + padding.top;
    let captionHeight = 20;

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        if (child.type === 'element' && child.computedStyle?.display === 'none') continue;
        this.layoutNode(child, x + padding.left, contentY, contentWidth, maxHeight);
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
