/**
 * JSCSS Canvas Renderer
 * 将布局和装饰数据渲染到Canvas上
 */

class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  /**
   * 渲染整个DOM树
   */
  render(rootNode, viewportWidth, viewportHeight) {
    this.canvas.width = viewportWidth;
    this.canvas.height = viewportHeight;
    
    // 清空画布
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, viewportWidth, viewportHeight);
    
    // 递归渲染节点
    this.renderNode(rootNode);
  }

  /**
   * 渲染单个节点
   */
  renderNode(node) {
    if (node.type !== 'element') {
      // 渲染文本节点
      if (node.type === 'text' && node.textContent) {
        // 文本渲染需要父元素的布局信息
        // 这里简化处理
      }
      return;
    }

    const layout = node.jscsslayout;
    const decorations = node.jscssdecorations;

    if (layout) {
      this.drawElement(layout, decorations, node);
    }

    // 递归渲染子元素
    if (node.children) {
      for (const child of node.children) {
        this.renderNode(child);
      }
    }
  }

  /**
   * 绘制单个元素
   */
  drawElement(layout, decorations, node) {
    const { x, y, width, height } = layout;

    // 保存上下文状态
    this.ctx.save();

    // 绘制阴影 (box-shadow)
    if (decorations && decorations.boxShadow && decorations.boxShadow !== 'none') {
      this.drawBoxShadow(x, y, width, height, decorations.boxShadow, decorations.borderRadius);
    }

    // 绘制背景
    if (decorations && decorations.backgroundColor) {
      this.drawBackground(x, y, width, height, decorations);
    }

    // 绘制边框
    if (decorations && decorations.borderWidth) {
      this.drawBorder(x, y, width, height, decorations);
    }

    // 绘制文字（简化版）
    if (node.textContent && node.textContent.trim()) {
      this.drawText(x, y, width, height, node.textContent, decorations);
    }

    // 恢复上下文状态
    this.ctx.restore();
  }

  /**
   * 绘制背景
   */
  drawBackground(x, y, width, height, decorations) {
    const bgColor = decorations.backgroundColor;
    
    if (bgColor === 'transparent') {
      return;
    }

    // 设置填充样式
    if (typeof bgColor === 'string') {
      this.ctx.fillStyle = bgColor;
    } else if (bgColor.type === 'rgba') {
      this.ctx.fillStyle = `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, ${bgColor.a})`;
    }

    // 绘制圆角或直角矩形
    const borderRadius = decorations.borderRadius || {};
    
    if (borderRadius.topLeft || borderRadius.topRight || 
        borderRadius.bottomRight || borderRadius.bottomLeft) {
      this.drawRoundRect(x, y, width, height, borderRadius);
      this.ctx.fill();
    } else {
      this.ctx.fillRect(x, y, width, height);
    }

    // TODO: 支持背景图片和渐变
  }

  /**
   * 绘制边框
   */
  drawBorder(x, y, width, height, decorations) {
    const borderWidth = decorations.borderWidth || {};
    const borderColor = decorations.borderColor || {};
    const borderStyle = decorations.borderStyle || {};

    // 检查是否有边框
    const hasBorder = (borderWidth.top > 0) || (borderWidth.right > 0) || 
                     (borderWidth.bottom > 0) || (borderWidth.left > 0);

    if (!hasBorder) {
      return;
    }

    // 简化版本：如果所有边框相同，绘制统一边框
    const allSame = (borderWidth.top === borderWidth.right &&
                    borderWidth.right === borderWidth.bottom &&
                    borderWidth.bottom === borderWidth.left);

    if (allSame && borderWidth.top > 0) {
      const color = borderColor.top;
      let colorStr = 'black';
      
      if (typeof color === 'string') {
        colorStr = color;
      } else if (color && color.type === 'rgba') {
        colorStr = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
      }

      this.ctx.strokeStyle = colorStr;
      this.ctx.lineWidth = borderWidth.top;

      const borderRadius = decorations.borderRadius || {};
      if (borderRadius.topLeft || borderRadius.topRight || 
          borderRadius.bottomRight || borderRadius.bottomLeft) {
        this.drawRoundRect(x + borderWidth.top/2, y + borderWidth.top/2, 
                          width - borderWidth.top, height - borderWidth.top, borderRadius);
        this.ctx.stroke();
      } else {
        this.ctx.strokeRect(x + borderWidth.top/2, y + borderWidth.top/2, 
                          width - borderWidth.top, height - borderWidth.top);
      }
    } else {
      // 分别绘制四条边框
      this.drawIndividualBorder(x, y, width, height, 'top', borderWidth, borderColor, borderStyle);
      this.drawIndividualBorder(x, y, width, height, 'right', borderWidth, borderColor, borderStyle);
      this.drawIndividualBorder(x, y, width, height, 'bottom', borderWidth, borderColor, borderStyle);
      this.drawIndividualBorder(x, y, width, height, 'left', borderWidth, borderColor, borderStyle);
    }
  }

  /**
   * 绘制单条边框
   */
  drawIndividualBorder(x, y, width, height, side, borderWidth, borderColor, borderStyle) {
    const widthVal = borderWidth[side] || 0;
    if (widthVal <= 0) return;

    const color = borderColor[side];
    let colorStr = 'black';
    
    if (typeof color === 'string') {
      colorStr = color;
    } else if (color && color.type === 'rgba') {
      colorStr = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
    }

    this.ctx.strokeStyle = colorStr;
    this.ctx.lineWidth = widthVal;
    this.ctx.beginPath();

    switch (side) {
      case 'top':
        this.ctx.moveTo(x, y + widthVal/2);
        this.ctx.lineTo(x + width, y + widthVal/2);
        break;
      case 'right':
        this.ctx.moveTo(x + width - widthVal/2, y);
        this.ctx.lineTo(x + width - widthVal/2, y + height);
        break;
      case 'bottom':
        this.ctx.moveTo(x, y + height - widthVal/2);
        this.ctx.lineTo(x + width, y + height - widthVal/2);
        break;
      case 'left':
        this.ctx.moveTo(x + widthVal/2, y);
        this.ctx.lineTo(x + widthVal/2, y + height);
        break;
    }

    this.ctx.stroke();
  }

  /**
   * 绘制圆角矩形路径
   */
  drawRoundRect(x, y, width, height, borderRadius) {
    const tl = borderRadius.topLeft || 0;
    const tr = borderRadius.topRight || 0;
    const br = borderRadius.bottomRight || 0;
    const bl = borderRadius.bottomLeft || 0;

    this.ctx.beginPath();
    this.ctx.moveTo(x + tl, y);
    this.ctx.lineTo(x + width - tr, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + tr);
    this.ctx.lineTo(x + width, y + height - br);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - br, y + height);
    this.ctx.lineTo(x + bl, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - bl);
    this.ctx.lineTo(x, y + tl);
    this.ctx.quadraticCurveTo(x, y, x + tl, y);
    this.ctx.closePath();
  }

  /**
   * 绘制阴影
   */
  drawBoxShadow(x, y, width, height, boxShadows, borderRadius) {
    if (!Array.isArray(boxShadows)) return;

    for (const shadow of boxShadows) {
      const { inset, offsetX, offsetY, blurRadius, spreadRadius, color } = shadow;
      
      let colorStr = 'rgba(0,0,0,0.5)';
      if (typeof color === 'string') {
        colorStr = color;
      } else if (color && color.type === 'rgba') {
        colorStr = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
      }

      this.ctx.shadowColor = colorStr;
      this.ctx.shadowOffsetX = offsetX;
      this.ctx.shadowOffsetY = offsetY;
      this.ctx.shadowBlur = blurRadius;

      // 绘制带阴影的占位图形
      if (borderRadius && (borderRadius.topLeft || borderRadius.topRight || 
          borderRadius.bottomRight || borderRadius.bottomLeft)) {
        this.drawRoundRect(x - spreadRadius, y - spreadRadius, 
                          width + spreadRadius * 2, height + spreadRadius * 2, borderRadius);
      } else {
        this.ctx.rect(x - spreadRadius, y - spreadRadius, 
                      width + spreadRadius * 2, height + spreadRadius * 2);
      }
      
      this.ctx.fillStyle = 'transparent';
      this.ctx.fill();
      
      // 清除阴影设置，避免影响后续绘制
      this.ctx.shadowColor = 'transparent';
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;
      this.ctx.shadowBlur = 0;
    }
  }

  /**
   * 绘制文本
   */
  drawText(x, y, width, height, text, decorations) {
    // 设置文字颜色
    if (decorations && decorations.color) {
      if (typeof decorations.color === 'string') {
        this.ctx.fillStyle = decorations.color;
      } else if (decorations.color.type === 'rgba') {
        this.ctx.fillStyle = `rgba(${decorations.color.r}, ${decorations.color.g}, ${decorations.color.b}, ${decorations.color.a})`;
      }
    } else {
      this.ctx.fillStyle = 'black';
    }

    // 简化版文字绘制
    this.ctx.font = '14px Arial';
    this.ctx.textBaseline = 'top';
    
    // 简单的换行处理
    const maxWidth = width - 20;
    const lines = this.wrapText(text, maxWidth);
    const lineHeight = 20;
    
    for (let i = 0; i < lines.length; i++) {
      this.ctx.fillText(lines[i], x + 10, y + 10 + i * lineHeight);
    }
  }

  /**
   * 简单的文本换行
   */
  wrapText(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + ' ' + words[i];
      const metrics = this.ctx.measureText(testLine);
      
      if (metrics.width <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    
    lines.push(currentLine);
    return lines;
  }

  /**
   * 从JSCSS实例渲染
   */
  renderFromJSCSS(jscssInstance, viewportWidth = 800, viewportHeight = 600) {
    this.canvas.width = viewportWidth;
    this.canvas.height = viewportHeight;
    
    // 清空画布
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, viewportWidth, viewportHeight);
    
    if (jscssInstance.root) {
      this.renderNode(jscssInstance.root);
    }
  }
}

module.exports = CanvasRenderer;
