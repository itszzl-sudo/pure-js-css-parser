try {
  const JSCSS = require('./index');
  
  const jscss = new JSCSS();
  jscss.loadHTML('<table><tr><td id="cell" style="height:80px;vertical-align:bottom;">Aligned</td></tr></table>');
  jscss.computeLayout();
  const layoutData = jscss.getLayoutData();
  console.log('Layout:', JSON.stringify(layoutData, null, 2));
} catch (e) {
  console.error('Error:', e.message);
  console.error(e.stack);
}
