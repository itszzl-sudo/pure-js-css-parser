class CSSParser {
  parse(css) {
    const styles = [];
    let cssClean = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const ruleRegex = /([^{]+)\{([^}]+)\}/g;
    let match;

    while ((match = ruleRegex.exec(cssClean)) !== null) {
      const selector = match[1].trim();
      const declarations = {};
      const declarationRegex = /([^:]+):([^;]+);?/g;
      let decMatch;

      while ((decMatch = declarationRegex.exec(match[2])) !== null) {
        const prop = decMatch[1].trim().toLowerCase();
        const value = decMatch[2].trim();
        declarations[prop] = value;
      }

      styles.push({
        selector,
        declarations
      });
    }

    return styles;
  }
}

module.exports = CSSParser;
