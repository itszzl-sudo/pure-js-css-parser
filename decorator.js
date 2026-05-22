/**
 * CSS Decorator Module
 * Handles CSS decorative properties (colors, shadows, borders, backgrounds, gradients, etc.)
 */

class CSSDecorator {
  constructor() {
    this.defaultDecorations = {
      backgroundColor: 'transparent',
      backgroundImage: 'none',
      backgroundPosition: '0% 0%',
      backgroundSize: 'auto auto',
      backgroundRepeat: 'repeat',
      backgroundAttachment: 'scroll',
      backgroundClip: 'border-box',
      backgroundOrigin: 'padding-box',
      
      borderWidth: { top: 0, right: 0, bottom: 0, left: 0 },
      borderStyle: { top: 'none', right: 'none', bottom: 'none', left: 'none' },
      borderColor: { top: 'currentColor', right: 'currentColor', bottom: 'currentColor', left: 'currentColor' },
      borderRadius: {
        topLeft: 0, topRight: 0,
        bottomRight: 0, bottomLeft: 0
      },
      
      boxShadow: 'none',
      textShadow: 'none',
      filter: 'none',
      backdropFilter: 'none',
      
      color: 'black',
      opacity: 1,
      
      outlineWidth: 0,
      outlineStyle: 'none',
      outlineColor: 'currentColor',
      outlineOffset: 0,
      
      boxSizing: 'content-box',
      overflow: 'visible',
      overflowX: 'visible',
      overflowY: 'visible',
      
      cursor: 'auto',
      pointerEvents: 'auto',
      userSelect: 'auto',
      
      display: 'block',
      visibility: 'visible',
      
      mixBlendMode: 'normal',
      isolation: 'auto',
      zIndex: 'auto'
    };
  }

  /**
   * Apply decorative styles to DOM tree after layout
   * @param {Object} root - DOM root node
   * @param {Array} styles - Parsed CSS styles
   */
  applyDecorations(root, styles) {
    this.applyDecorationsToNode(root, styles);
  }

  /**
   * Recursively apply decorations to node and children
   */
  applyDecorationsToNode(node, styles) {
    if (node.type === 'element') {
      node.jscssdecorations = this.computeNodeDecorations(node, styles);
    }
    
    if (node.children) {
      for (let child of node.children) {
        this.applyDecorationsToNode(child, styles);
      }
    }
  }

  /**
   * Compute decorative properties for a single node
   */
  computeNodeDecorations(node, styles) {
    const decorations = { ...this.defaultDecorations };
    const computedStyle = node.computedStyle || {};
    
    // Colors and background
    if (computedStyle.color) {
      decorations.color = this.parseColor(computedStyle.color);
    }
    
    if (computedStyle.backgroundColor) {
      decorations.backgroundColor = this.parseColor(computedStyle.backgroundColor);
    }
    
    if (computedStyle.backgroundImage) {
      decorations.backgroundImage = this.parseBackgroundImage(computedStyle.backgroundImage);
    }
    
    if (computedStyle.backgroundPosition) {
      decorations.backgroundPosition = this.parseBackgroundPosition(computedStyle.backgroundPosition);
    }
    
    if (computedStyle.backgroundSize) {
      decorations.backgroundSize = this.parseBackgroundSize(computedStyle.backgroundSize);
    }
    
    if (computedStyle.backgroundRepeat) {
      decorations.backgroundRepeat = computedStyle.backgroundRepeat;
    }
    
    // Borders
    this.parseBorderProperties(decorations, computedStyle);
    
    if (computedStyle.borderRadius) {
      decorations.borderRadius = this.parseBorderRadius(computedStyle.borderRadius);
    }
    
    // Shadows and filters
    if (computedStyle.boxShadow) {
      decorations.boxShadow = this.parseBoxShadow(computedStyle.boxShadow);
    }
    
    if (computedStyle.textShadow) {
      decorations.textShadow = this.parseTextShadow(computedStyle.textShadow);
    }
    
    if (computedStyle.filter) {
      decorations.filter = this.parseFilter(computedStyle.filter);
    }
    
    if (computedStyle.backdropFilter) {
      decorations.backdropFilter = this.parseFilter(computedStyle.backdropFilter);
    }
    
    // Opacity
    if (computedStyle.opacity) {
      decorations.opacity = this.parseOpacity(computedStyle.opacity);
    }
    
    // Outline
    this.parseOutlineProperties(decorations, computedStyle);
    
    // Overflow and display
    if (computedStyle.overflow) {
      decorations.overflow = computedStyle.overflow;
    }
    
    if (computedStyle.overflowX) {
      decorations.overflowX = computedStyle.overflowX;
    }
    
    if (computedStyle.overflowY) {
      decorations.overflowY = computedStyle.overflowY;
    }
    
    if (computedStyle.visibility) {
      decorations.visibility = computedStyle.visibility;
    }
    
    if (computedStyle.boxSizing) {
      decorations.boxSizing = computedStyle.boxSizing;
    }
    
    // Blend modes and z-index
    if (computedStyle.mixBlendMode) {
      decorations.mixBlendMode = computedStyle.mixBlendMode;
    }
    
    if (computedStyle.zIndex) {
      decorations.zIndex = computedStyle.zIndex;
    }
    
    // Cursor and interaction
    if (computedStyle.cursor) {
      decorations.cursor = computedStyle.cursor;
    }
    
    if (computedStyle.pointerEvents) {
      decorations.pointerEvents = computedStyle.pointerEvents;
    }
    
    if (computedStyle.userSelect) {
      decorations.userSelect = computedStyle.userSelect;
    }
    
    return decorations;
  }

  /**
   * Parse CSS color value
   */
  parseColor(colorStr) {
    if (!colorStr || colorStr === 'transparent' || colorStr === 'currentColor') {
      return colorStr;
    }
    
    colorStr = colorStr.trim().toLowerCase();
    
    // Named colors
    const namedColors = {
      'black': '#000000', 'white': '#ffffff', 'red': '#ff0000',
      'green': '#008000', 'blue': '#0000ff', 'yellow': '#ffff00',
      'orange': '#ffa500', 'purple': '#800080', 'pink': '#ffc0cb',
      'gray': '#808080', 'grey': '#808080', 'cyan': '#00ffff',
      'magenta': '#ff00ff', 'brown': '#a52a2a', 'maroon': '#800000',
      'olive': '#808000', 'lime': '#00ff00', 'aquamarine': '#7fffd4',
      'teal': '#008080', 'navy': '#000080', 'tan': '#d2b48c',
      'tomato': '#ff6347'
    };
    
    if (namedColors[colorStr]) {
      return this.hexToRGBA(namedColors[colorStr]);
    }
    
    // Hex colors
    if (colorStr.startsWith('#')) {
      return this.hexToRGBA(colorStr);
    }
    
    // RGB/RGBA
    if (colorStr.startsWith('rgb(') || colorStr.startsWith('rgba(')) {
      return this.parseRGB(colorStr);
    }
    
    // HSL/HSLA
    if (colorStr.startsWith('hsl(') || colorStr.startsWith('hsla(')) {
      return this.parseHSL(colorStr);
    }
    
    return colorStr;
  }

  hexToRGBA(hex) {
    hex = hex.replace('#', '');
    let r, g, b, a = 255;
    
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 4) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
      a = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else if (hex.length === 8) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
      a = parseInt(hex.substring(6, 8), 16);
    }
    
    return { type: 'rgba', r, g, b, a: a / 255 };
  }

  parseRGB(rgbStr) {
    const match = rgbStr.match(/rgba?\s*\(\s*(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)\s*(?:,?\s*([\d.]+))?\s*\)/i);
    if (match) {
      return {
        type: 'rgba',
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
        a: match[4] ? parseFloat(match[4]) : 1
      };
    }
    return rgbStr;
  }

  parseHSL(hslStr) {
    const match = hslStr.match(/hsla?\s*\(\s*([\d.]+)\s*,?\s*([\d.]+)%\s*,?\s*([\d.]+)%\s*(?:,?\s*([\d.]+))?\s*\)/i);
    if (match) {
      const h = parseFloat(match[1]) % 360;
      const s = parseFloat(match[2]) / 100;
      const l = parseFloat(match[3]) / 100;
      const a = match[4] ? parseFloat(match[4]) : 1;
      
      const rgb = this.hslToRgb(h, s, l);
      return { type: 'rgba', ...rgb, a };
    }
    return hslStr;
  }

  hslToRgb(h, s, l) {
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h / 360 + 1/3);
      g = hue2rgb(p, q, h / 360);
      b = hue2rgb(p, q, h / 360 - 1/3);
    }
    
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  parseBorderProperties(decorations, computedStyle) {
    const borderShorthand = ['', 'Top', 'Right', 'Bottom', 'Left'];
    
    for (const side of borderShorthand) {
      const widthProp = `border${side}Width`;
      const styleProp = `border${side}Style`;
      const colorProp = `border${side}Color`;
      
      if (computedStyle[widthProp]) {
        const value = this.parseBorderWidth(computedStyle[widthProp]);
        if (side === '') {
          decorations.borderWidth = { top: value, right: value, bottom: value, left: value };
        } else {
          decorations.borderWidth[side.toLowerCase()] = value;
        }
      }
      
      if (computedStyle[styleProp]) {
        const value = computedStyle[styleProp];
        if (side === '') {
          decorations.borderStyle = { top: value, right: value, bottom: value, left: value };
        } else {
          decorations.borderStyle[side.toLowerCase()] = value;
        }
      }
      
      if (computedStyle[colorProp]) {
        const value = this.parseColor(computedStyle[colorProp]);
        if (side === '') {
          decorations.borderColor = { top: value, right: value, bottom: value, left: value };
        } else {
          decorations.borderColor[side.toLowerCase()] = value;
        }
      }
    }
  }

  parseBorderWidth(widthStr) {
    const keywordMap = {
      'thin': 1,
      'medium': 3,
      'thick': 5
    };
    
    if (keywordMap[widthStr]) {
      return keywordMap[widthStr];
    }
    
    const numMatch = widthStr.match(/([\d.]+)(px)?/i);
    if (numMatch) {
      return parseFloat(numMatch[1]);
    }
    
    return 0;
  }

  parseBorderRadius(radiusStr) {
    const parts = radiusStr.split(/\s+/).map(p => p.trim()).filter(p => p);
    const result = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };
    
    const values = parts.map(p => {
      const numMatch = p.match(/([\d.]+)(px|%)?/i);
      return numMatch ? parseFloat(numMatch[1]) : 0;
    });
    
    if (values.length === 1) {
      result.topLeft = result.topRight = result.bottomRight = result.bottomLeft = values[0];
    } else if (values.length === 2) {
      result.topLeft = result.bottomRight = values[0];
      result.topRight = result.bottomLeft = values[1];
    } else if (values.length === 3) {
      result.topLeft = values[0];
      result.topRight = result.bottomLeft = values[1];
      result.bottomRight = values[2];
    } else if (values.length === 4) {
      result.topLeft = values[0];
      result.topRight = values[1];
      result.bottomRight = values[2];
      result.bottomLeft = values[3];
    }
    
    return result;
  }

  parseBoxShadow(shadowStr) {
    if (shadowStr === 'none') return 'none';
    
    const shadows = [];
    const shadowParts = this.splitShadowString(shadowStr);
    
    for (const part of shadowParts) {
      shadows.push(this.parseSingleBoxShadow(part));
    }
    
    return shadows;
  }

  splitShadowString(str) {
    const parts = [];
    let current = '';
    let parenCount = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '(') parenCount++;
      else if (char === ')') parenCount--;
      else if (char === ',' && parenCount === 0) {
        if (current.trim()) parts.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    
    if (current.trim()) parts.push(current.trim());
    
    return parts;
  }

  parseSingleBoxShadow(shadowStr) {
    const result = {
      inset: false,
      offsetX: 0,
      offsetY: 0,
      blurRadius: 0,
      spreadRadius: 0,
      color: null
    };
    
    const parts = shadowStr.split(/\s+/).filter(p => p);
    let numberCount = 0;
    
    for (const part of parts) {
      if (part === 'inset') {
        result.inset = true;
      } else if (part.match(/^-?[\d.]+(px)?$/)) {
        const value = parseFloat(part);
        if (numberCount === 0) result.offsetX = value;
        else if (numberCount === 1) result.offsetY = value;
        else if (numberCount === 2) result.blurRadius = value;
        else if (numberCount === 3) result.spreadRadius = value;
        numberCount++;
      } else {
        result.color = this.parseColor(part);
      }
    }
    
    return result;
  }

  parseTextShadow(shadowStr) {
    if (shadowStr === 'none') return 'none';
    
    const shadows = [];
    const shadowParts = this.splitShadowString(shadowStr);
    
    for (const part of shadowParts) {
      shadows.push(this.parseSingleTextShadow(part));
    }
    
    return shadows;
  }

  parseSingleTextShadow(shadowStr) {
    const result = {
      offsetX: 0,
      offsetY: 0,
      blurRadius: 0,
      color: null
    };
    
    const parts = shadowStr.split(/\s+/).filter(p => p);
    let numberCount = 0;
    
    for (const part of parts) {
      if (part.match(/^-?[\d.]+(px)?$/)) {
        const value = parseFloat(part);
        if (numberCount === 0) result.offsetX = value;
        else if (numberCount === 1) result.offsetY = value;
        else if (numberCount === 2) result.blurRadius = value;
        numberCount++;
      } else {
        result.color = this.parseColor(part);
      }
    }
    
    return result;
  }

  parseFilter(filterStr) {
    if (filterStr === 'none') return 'none';
    
    const filters = [];
    const parts = filterStr.match(/(\w+)\s*\(([^)]+)\)/g) || [];
    
    for (const part of parts) {
      const match = part.match(/(\w+)\s*\(([^)]+)\)/);
      if (match) {
        filters.push({
          type: match[1],
          value: match[2].trim()
        });
      }
    }
    
    return filters;
  }

  parseBackgroundImage(imageStr) {
    if (imageStr === 'none') return 'none';
    
    const images = [];
    const parts = this.splitShadowString(imageStr);
    
    for (const part of parts) {
      const urlMatch = part.match(/url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/i);
      const gradientMatch = part.match(/^(linear|radial|conic)-gradient\s*\(/i);
      
      if (urlMatch) {
        images.push({
          type: 'url',
          url: urlMatch[1]
        });
      } else if (gradientMatch) {
        images.push({
          type: 'gradient',
          gradientType: gradientMatch[1],
          value: part
        });
      }
    }
    
    return images.length ? images : imageStr;
  }

  parseBackgroundPosition(posStr) {
    const parts = posStr.split(/\s+/).filter(p => p);
    
    if (parts.length === 1) {
      return { x: parts[0], y: '50%' };
    } else if (parts.length === 2) {
      return { x: parts[0], y: parts[1] };
    }
    
    return posStr;
  }

  parseBackgroundSize(sizeStr) {
    const parts = sizeStr.split(/\s+/).filter(p => p);
    
    if (parts.length === 1) {
      if (parts[0] === 'cover' || parts[0] === 'contain') {
        return parts[0];
      }
      return { width: parts[0], height: 'auto' };
    } else if (parts.length === 2) {
      return { width: parts[0], height: parts[1] };
    }
    
    return sizeStr;
  }

  parseOutlineProperties(decorations, computedStyle) {
    if (computedStyle.outlineWidth) {
      decorations.outlineWidth = this.parseBorderWidth(computedStyle.outlineWidth);
    }
    
    if (computedStyle.outlineStyle) {
      decorations.outlineStyle = computedStyle.outlineStyle;
    }
    
    if (computedStyle.outlineColor) {
      decorations.outlineColor = this.parseColor(computedStyle.outlineColor);
    }
    
    if (computedStyle.outlineOffset) {
      const numMatch = computedStyle.outlineOffset.match(/([\d.]+)(px)?/i);
      decorations.outlineOffset = numMatch ? parseFloat(numMatch[1]) : 0;
    }
  }

  parseOpacity(opacityStr) {
    const value = parseFloat(opacityStr);
    return isNaN(value) ? 1 : Math.max(0, Math.min(1, value));
  }

  /**
   * Get decorations for a specific node
   */
  getDecorations(node) {
    return node.jscssdecorations || { ...this.defaultDecorations };
  }

  /**
   * Serialize decorations to CSS string
   */
  serializeDecorations(decorations) {
    const parts = [];
    
    if (decorations.color && decorations.color !== 'black') {
      parts.push(`color: ${this.colorToString(decorations.color)}`);
    }
    
    if (decorations.backgroundColor && decorations.backgroundColor !== 'transparent') {
      parts.push(`background-color: ${this.colorToString(decorations.backgroundColor)}`);
    }
    
    if (decorations.boxShadow && decorations.boxShadow !== 'none') {
      parts.push(`box-shadow: ${this.boxShadowToString(decorations.boxShadow)}`);
    }
    
    if (decorations.textShadow && decorations.textShadow !== 'none') {
      parts.push(`text-shadow: ${this.textShadowToString(decorations.textShadow)}`);
    }
    
    if (decorations.opacity !== 1) {
      parts.push(`opacity: ${decorations.opacity}`);
    }
    
    // Border
    const borderStr = this.borderToString(decorations);
    if (borderStr) {
      parts.push(borderStr);
    }
    
    // Border radius
    const borderRadiusStr = this.borderRadiusToString(decorations.borderRadius);
    if (borderRadiusStr) {
      parts.push(`border-radius: ${borderRadiusStr}`);
    }
    
    return parts.join('; ');
  }

  colorToString(color) {
    if (typeof color === 'string') return color;
    if (color.type === 'rgba') {
      return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
    }
    return String(color);
  }

  boxShadowToString(shadows) {
    if (!Array.isArray(shadows)) return 'none';
    
    return shadows.map(s => {
      const parts = [];
      if (s.inset) parts.push('inset');
      parts.push(`${s.offsetX}px`);
      parts.push(`${s.offsetY}px`);
      if (s.blurRadius) parts.push(`${s.blurRadius}px`);
      if (s.spreadRadius) parts.push(`${s.spreadRadius}px`);
      if (s.color) parts.push(this.colorToString(s.color));
      return parts.join(' ');
    }).join(', ');
  }

  textShadowToString(shadows) {
    if (!Array.isArray(shadows)) return 'none';
    
    return shadows.map(s => {
      const parts = [];
      parts.push(`${s.offsetX}px`);
      parts.push(`${s.offsetY}px`);
      if (s.blurRadius) parts.push(`${s.blurRadius}px`);
      if (s.color) parts.push(this.colorToString(s.color));
      return parts.join(' ');
    }).join(', ');
  }

  borderToString(decorations) {
    const { borderWidth, borderStyle, borderColor } = decorations;
    
    const sameWidth = borderWidth.top === borderWidth.right &&
                      borderWidth.right === borderWidth.bottom &&
                      borderWidth.bottom === borderWidth.left;
    
    const sameStyle = borderStyle.top === borderStyle.right &&
                      borderStyle.right === borderStyle.bottom &&
                      borderStyle.bottom === borderStyle.left;
    
    const sameColor = borderColor.top === borderColor.right &&
                      borderColor.right === borderColor.bottom &&
                      borderColor.bottom === borderColor.left;
    
    if (sameWidth && sameStyle && sameColor && borderWidth.top > 0) {
      return `border: ${borderWidth.top}px ${borderStyle.top} ${this.colorToString(borderColor.top)}`;
    }
    
    const parts = [];
    const sides = ['Top', 'Right', 'Bottom', 'Left'];
    
    for (const side of sides) {
      const width = borderWidth[side.toLowerCase()];
      const style = borderStyle[side.toLowerCase()];
      const color = borderColor[side.toLowerCase()];
      
      if (width > 0) {
        parts.push(`border${side}: ${width}px ${style} ${this.colorToString(color)}`);
      }
    }
    
    return parts.join('; ');
  }

  borderRadiusToString(borderRadius) {
    if (!borderRadius) return '';
    
    const { topLeft, topRight, bottomRight, bottomLeft } = borderRadius;
    
    if (topLeft === topRight && topRight === bottomRight && bottomRight === bottomLeft) {
      return topLeft > 0 ? `${topLeft}px` : '';
    }
    
    return `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`;
  }
}

module.exports = CSSDecorator;
