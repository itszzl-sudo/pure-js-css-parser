class CSSParser {
  constructor() {
    this.variables = {};
    this.globalVariables = {};
    this.supportedProperties = new Set([
      'width', 'height', 'margin', 'padding', 'border', 'display', 'position',
      'top', 'left', 'right', 'bottom', 'float', 'clear', 'font-size', 'line-height',
      'text-align', 'vertical-align', 'visibility', 'overflow', 'overflow-x', 'overflow-y',
      'z-index', 'box-sizing', 'flex-direction', 'flex-wrap', 'justify-content',
      'align-items', 'align-content', 'align-self', 'flex-grow', 'flex-shrink',
      'flex-basis', 'order', 'gap', 'row-gap', 'column-gap', 'grid-template-columns',
      'grid-template-rows', 'grid-template-areas', 'grid-column', 'grid-row',
      'grid-area', 'grid-auto-flow', 'grid-auto-columns', 'grid-auto-rows',
      'column-count', 'column-width', 'column-gap', 'column-rule-width',
      'column-rule-style', 'column-rule-color', 'column-span', 'column-fill',
      'transform', 'transform-origin', 'opacity', 'border-collapse', 'border-spacing',
      'caption-side', 'table-layout', 'white-space', 'min-width', 'max-width',
      'min-height', 'max-height', 'aspect-ratio', 'word-wrap', 'overflow-wrap',
      'outline', 'outline-width', 'outline-style', 'outline-color', 'object-fit',
      'object-position', 'resize', 'cursor', 'pointer-events', 'user-select',
      'box-shadow', 'text-shadow', 'backdrop-filter', 'filter', 'transition',
      'animation', 'writing-mode', 'direction', 'text-orientation', 'margin-inline',
      'margin-block', 'padding-inline', 'padding-block', 'inset', 'inset-inline',
      'inset-block', 'margin-inline-start', 'margin-inline-end', 'margin-block-start',
      'margin-block-end', 'padding-inline-start', 'padding-inline-end',
      'padding-block-start', 'padding-block-end', 'inset-inline-start',
      'inset-inline-end', 'inset-block-start', 'inset-block-end', 'inline-size',
      'block-size', 'max-inline-size', 'min-inline-size', 'max-block-size',
      'min-block-size', 'break-before', 'break-after', 'break-inside',
      'orphans', 'widows', 'text-overflow'
    ]);
  }

  parse(css) {
    const styles = [];
    let cssClean = css.replace(/\/\*[\s\S]*?\*\//g, '');
    
    this.extractGlobalVariables(cssClean);
    
    const supportsRegex = /@supports\s+([^{]+)\{([\s\S]*?)\}\s*\}/gi;
    let supportsMatch;
    
    while ((supportsMatch = supportsRegex.exec(cssClean)) !== null) {
      const supportsCondition = supportsMatch[1].trim();
      const supportsContent = supportsMatch[2];
      
      if (this.evaluateSupportsCondition(supportsCondition)) {
        const supportsRules = this.parseRules(supportsContent);
        supportsRules.forEach(rule => {
          styles.push({
            selector: rule.selector,
            declarations: rule.declarations,
            mediaQuery: null,
            supportsQuery: supportsCondition,
            variables: { ...this.globalVariables, ...rule.variables }
          });
        });
      }
    }
    
    cssClean = cssClean.replace(/@supports\s+[^{]+\{[\s\S]*?\}\s*\}/gi, '');
    
    const mediaRegex = /@media\s+([^{]+)\{([\s\S]*?)\}\s*\}/gi;
    let mediaMatch;
    
    while ((mediaMatch = mediaRegex.exec(cssClean)) !== null) {
      const mediaQuery = mediaMatch[1].trim();
      const mediaContent = mediaMatch[2];
      
      const mediaRules = this.parseRules(mediaContent);
      mediaRules.forEach(rule => {
        styles.push({
          selector: rule.selector,
          declarations: rule.declarations,
          mediaQuery: mediaQuery,
          variables: { ...this.globalVariables, ...rule.variables }
        });
      });
    }
    
    const nonMediaCss = cssClean.replace(/@media\s+[^{]+\{[\s\S]*?\}\s*\}/gi, '');
    const regularRules = this.parseRules(nonMediaCss);
    regularRules.forEach(rule => {
      styles.push({
        selector: rule.selector,
        declarations: rule.declarations,
        mediaQuery: null,
        variables: { ...this.globalVariables, ...rule.variables }
      });
    });
    
    return styles;
  }
  
  evaluateSupportsCondition(condition) {
    const trimmed = condition.trim();
    
    if (trimmed.startsWith('not ')) {
      return !this.evaluateSupportsCondition(trimmed.slice(4));
    }
    
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      return this.evaluateSupportsCondition(trimmed.slice(1, -1));
    }
    
    const andMatch = trimmed.match(/^(.*?)\s+and\s+(.*)$/i);
    if (andMatch) {
      return this.evaluateSupportsCondition(andMatch[1]) && 
             this.evaluateSupportsCondition(andMatch[2]);
    }
    
    const orMatch = trimmed.match(/^(.*?)\s+or\s+(.*)$/i);
    if (orMatch) {
      return this.evaluateSupportsCondition(orMatch[1]) || 
             this.evaluateSupportsCondition(orMatch[2]);
    }
    
    const propValueMatch = trimmed.match(/^\s*([\w-]+)\s*:\s*([^;]+)\s*$/);
    if (propValueMatch) {
      const property = propValueMatch[1].toLowerCase();
      return this.supportedProperties.has(property);
    }
    
    return false;
  }
  
  extractGlobalVariables(css) {
    const rootRuleRegex = /:root\s*\{([^}]+)\}/i;
    const match = rootRuleRegex.exec(css);
    
    if (match) {
      const content = match[1];
      const declarationRegex = /([^:]+):([^;]+);?/g;
      let decMatch;
      
      while ((decMatch = declarationRegex.exec(content)) !== null) {
        const prop = decMatch[1].trim();
        const value = decMatch[2].trim();
        
        if (prop.startsWith('--')) {
          this.globalVariables[prop] = value;
        }
      }
    }
  }
  
  parseRules(cssContent) {
    const rules = [];
    const ruleRegex = /([^{]+)\{([^}]+)\}/g;
    let match;
    
    while ((match = ruleRegex.exec(cssContent)) !== null) {
      const selector = match[1].trim();
      const declarations = {};
      const importantDeclarations = new Set();
      const variables = {};
      const declarationRegex = /([^:]+):([^;]+);?/g;
      let decMatch;
      
      while ((decMatch = declarationRegex.exec(match[2])) !== null) {
        let prop = decMatch[1].trim();
        let value = decMatch[2].trim();
        
        // Check for !important
        const isImportant = value.toLowerCase().endsWith('!important');
        if (isImportant) {
          value = value.slice(0, -'!important'.length).trim();
          importantDeclarations.add(prop);
        }
        
        if (prop.startsWith('--')) {
          variables[prop] = value;
        } else {
          declarations[prop] = value;
        }
      }
      
      rules.push({
        selector,
        declarations,
        importantDeclarations,
        variables
      });
    }
    
    return rules;
  }
  
  resolveVariables(value, variables = {}) {
    if (!value || typeof value !== 'string') {
      return value;
    }
    
    const varRegex = /var\(\s*([^,)]+)(?:\s*,\s*([^)]+))?\s*\)/g;
    
    return value.replace(varRegex, (match, varName, fallback) => {
      varName = varName.trim();
      
      if (variables[varName]) {
        return this.resolveVariables(variables[varName], variables);
      }
      
      if (this.globalVariables[varName]) {
        return this.resolveVariables(this.globalVariables[varName], variables);
      }
      
      if (fallback !== undefined) {
        return this.resolveVariables(fallback.trim(), variables);
      }
      
      return match;
    });
  }
  
  resolveAllVariables(declarations, variables = {}) {
    const resolved = {};
    
    for (const [prop, value] of Object.entries(declarations)) {
      if (prop.startsWith('--')) {
        resolved[prop] = value;
      } else {
        resolved[prop] = this.resolveVariables(value, { ...this.globalVariables, ...variables });
      }
    }
    
    return resolved;
  }
  
  parseMediaQuery(query) {
    const conditions = {};
    
    const widthMatch = query.match(/min-width:\s*(\d+)px/);
    if (widthMatch) conditions.minWidth = parseInt(widthMatch[1]);
    
    const maxWidthMatch = query.match(/max-width:\s*(\d+)px/);
    if (maxWidthMatch) conditions.maxWidth = parseInt(maxWidthMatch[1]);
    
    const heightMatch = query.match(/min-height:\s*(\d+)px/);
    if (heightMatch) conditions.minHeight = parseInt(heightMatch[1]);
    
    const maxHeightMatch = query.match(/max-height:\s*(\d+)px/);
    if (maxHeightMatch) conditions.maxHeight = parseInt(maxHeightMatch[1]);
    
    const screenMatch = query.match(/screen/);
    if (screenMatch) conditions.type = 'screen';
    
    const printMatch = query.match(/print/);
    if (printMatch) conditions.type = 'print';
    
    const orientationMatch = query.match(/orientation:\s*(landscape|portrait)/);
    if (orientationMatch) conditions.orientation = orientationMatch[1];
    
    return conditions;
  }
  
  matchesMediaQuery(query, viewportWidth, viewportHeight) {
    if (!query || query === 'all') return true;
    
    const conditions = this.parseMediaQuery(query);
    
    if (conditions.minWidth && viewportWidth < conditions.minWidth) return false;
    if (conditions.maxWidth && viewportWidth > conditions.maxWidth) return false;
    if (conditions.minHeight && viewportHeight < conditions.minHeight) return false;
    if (conditions.maxHeight && viewportHeight > conditions.maxHeight) return false;
    
    if (conditions.orientation) {
      const orientation = viewportWidth > viewportHeight ? 'landscape' : 'portrait';
      if (conditions.orientation !== orientation) return false;
    }
    
    return true;
  }
}

module.exports = CSSParser;
