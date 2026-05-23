use anyhow::Result;
use log::info;
use simple_browser::browser::SimpleBrowser;
use std::env;

fn main() -> Result<()> {
    // 初始化日志
    env_logger::init();
    
    info!("Starting Simple Browser...");
    
    // 获取命令行参数
    let args: Vec<String> = env::args().collect();
    let initial_url = args.get(1).cloned().unwrap_or_else(|| {
        "data:text/html,<html><body style='background:%233366ff;margin:0'><h1 style='color:white'>Welcome to Simple Browser</h1><p style='color:%23ffcc00'>Enter a URL to navigate.</p><div style='background:red;width:200px;height:100px'></div></body></html>".to_string()
    });
    
    // 创建并运行浏览器
    let mut browser = SimpleBrowser::new(1280, 800)?;
    browser.navigate(&initial_url, true)?; // 初始 URL 从调试面板加载
    browser.run()?;
    
    Ok(())
}
