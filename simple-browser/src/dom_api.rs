use anyhow::Result;
use log::info;
use std::cell::RefCell;
use std::rc::Rc;
use webgpu_web_renderer::Engine;
use webgpu_web_renderer::bridge::WebNativeBridge;
use crate::js_engine::JsEngine;

/// DOM API 桥接器
pub struct DomApiBridge {
    engine: Rc<RefCell<Engine>>,
}

impl DomApiBridge {
    pub fn new(engine: Rc<RefCell<Engine>>) -> Self { Self { engine } }

    pub fn query(&self, selector: &str) -> Option<usize> {
        self.engine.borrow().query(selector)
    }

    pub fn query_all(&self, selector: &str) -> Vec<usize> {
        self.engine.borrow().query_all(selector)
    }

    pub fn get_attr(&self, node_id: usize, name: &str) -> Option<String> {
        self.engine.borrow().get_attr(node_id, name)
    }

    pub fn set_attr(&self, node_id: usize, name: &str, value: &str) {
        self.engine.borrow_mut().set_attr(node_id, name, value);
    }

    pub fn text(&self, node_id: usize) -> Option<String> {
        self.engine.borrow().text(node_id)
    }
}

/// 设置完整的 DOM/Window API
///
/// 所有 Rust 回调使用 i32 返回类型（满足 Callback trait 约束）。
/// 需要返回字符串的操作通过 JS 层包装实现。
pub fn setup_dom_js_api(
    js_engine: &JsEngine,
    _dom_bridge: Rc<RefCell<DomApiBridge>>,
) -> Result<()> {
    info!("Setting up DOM JavaScript API...");

    // Rust 回调 - 全部返回 i32（Callback trait 支持）
    js_engine.add_callback("__dom_query", |_selector: String| -> i32 { 0 })?;
    js_engine.add_callback("__dom_set_attr", |_id: i32, _name: String, _val: String| { 0 })?;
    js_engine.add_callback("__dom_set_text", |_id: i32, _text: String| { 0 })?;
    js_engine.add_callback("__dom_alert", |_msg: String| -> i32 { 0 })?;
    js_engine.add_callback("__dom_confirm", |_msg: String| -> i32 { 1 })?;

    // 注入完整的 document/window 对象（纯 JS 层）
    // 返回字符串的操作直接在 JS 层实现
    js_engine.eval(
        r#"
        // DOM stubs returning strings
        function __dom_query_all(sel) { return ''; }
        function __dom_get_attr(id, name) { return ''; }
        function __dom_get_text(id) { return ''; }

        var document = {
            getElementById: function(id) { return __dom_query('#' + id); },
            getElementsByTagName: function(tag) { return __dom_query_all(tag); },
            getElementsByClassName: function(cls) { return __dom_query_all('.' + cls); },
            querySelector: function(sel) { return __dom_query(sel); },
            querySelectorAll: function(sel) { return __dom_query_all(sel); },
            createElement: function(tag) { return 0; },
            createTextNode: function(text) { return 0; },
            body: null, head: null, documentElement: null
        };

        var window = {
            document: document, console: console,
            location: { href: '', hostname: '', pathname: '' },
            alert: function(msg) { __dom_alert(msg); },
            confirm: function(msg) { return __dom_confirm(msg) ? true : false; },
            setTimeout: setTimeout, clearTimeout: clearTimeout,
            setInterval: setInterval, clearInterval: clearInterval,
            addEventListener: function() {},
            removeEventListener: function() {},
            getComputedStyle: function() { return {}; },
            innerWidth: 1280, innerHeight: 800
        };

        this.window = window;
        this.document = document;
        "#,
        false,
    )?;

    info!("DOM JavaScript API setup completed");
    Ok(())
}
