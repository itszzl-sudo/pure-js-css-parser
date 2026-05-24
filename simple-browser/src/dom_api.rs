use anyhow::Result;
use log::info;
use std::cell::RefCell;
use std::rc::Rc;
use webgpu_web_renderer::Engine;
use webgpu_web_renderer::bridge::WebNativeBridge;
use crate::js_engine::JsEngine;
use crate::web_storage;

/// 当前页面的 origin（用于 cookie 和 storage 回调）
/// 每次导航时通过 `update_origin()` 更新
static CURRENT_ORIGIN: std::sync::RwLock<String> = std::sync::RwLock::new(String::new());

/// 从 URL 提取 origin（scheme + host）
pub fn extract_origin(url: &str) -> String {
    if let Ok(parsed) = url::Url::parse(url) {
        let scheme = parsed.scheme();
        let host = parsed.host_str().unwrap_or("");
        format!("{}://{}", scheme, host)
    } else {
        url.to_string()
    }
}

/// 更新当前页面的 origin（导航时调用）
pub fn update_origin(url: &str) {
    let origin = extract_origin(url);
    if let Ok(mut guard) = CURRENT_ORIGIN.write() {
        *guard = origin;
    }
}

/// 获取当前 origin
fn get_current_origin() -> String {
    CURRENT_ORIGIN.read()
        .map(|g| g.clone())
        .unwrap_or_default()
}

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

    // ── Cookie 回调 ──
    js_engine.add_callback("__cookie_get", || -> String {
        let origin = get_current_origin();
        web_storage::cookie_js_get(&origin)
    })?;
    js_engine.add_callback("__cookie_set", |cookie_str: String| -> i32 {
        let origin = get_current_origin();
        web_storage::cookie_js_set(&origin, &cookie_str);
        0
    })?;

    // ── localStorage 回调 ──
    js_engine.add_callback("__localStorage_getItem", |key: String| -> String {
        let origin = get_current_origin();
        web_storage::storage_get_item(web_storage::StorageType::Local, &origin, &key)
            .unwrap_or_default()
    })?;
    js_engine.add_callback("__localStorage_setItem", |key: String, value: String| -> i32 {
        let origin = get_current_origin();
        web_storage::storage_set_item(web_storage::StorageType::Local, &origin, &key, &value);
        0
    })?;
    js_engine.add_callback("__localStorage_removeItem", |key: String| -> i32 {
        let origin = get_current_origin();
        web_storage::storage_remove_item(web_storage::StorageType::Local, &origin, &key);
        0
    })?;
    js_engine.add_callback("__localStorage_clear", || -> i32 {
        let origin = get_current_origin();
        web_storage::storage_clear(web_storage::StorageType::Local, &origin);
        0
    })?;
    js_engine.add_callback("__localStorage_length", || -> i32 {
        let origin = get_current_origin();
        web_storage::storage_length(web_storage::StorageType::Local, &origin) as i32
    })?;
    js_engine.add_callback("__localStorage_key", |index: i32| -> String {
        let origin = get_current_origin();
        if index < 0 {
            return String::new();
        }
        web_storage::storage_key(web_storage::StorageType::Local, &origin, index as u32)
            .unwrap_or_default()
    })?;

    // ── sessionStorage 回调 ──
    js_engine.add_callback("__sessionStorage_getItem", |key: String| -> String {
        let origin = get_current_origin();
        web_storage::storage_get_item(web_storage::StorageType::Session, &origin, &key)
            .unwrap_or_default()
    })?;
    js_engine.add_callback("__sessionStorage_setItem", |key: String, value: String| -> i32 {
        let origin = get_current_origin();
        web_storage::storage_set_item(web_storage::StorageType::Session, &origin, &key, &value);
        0
    })?;
    js_engine.add_callback("__sessionStorage_removeItem", |key: String| -> i32 {
        let origin = get_current_origin();
        web_storage::storage_remove_item(web_storage::StorageType::Session, &origin, &key);
        0
    })?;
    js_engine.add_callback("__sessionStorage_clear", || -> i32 {
        let origin = get_current_origin();
        web_storage::storage_clear(web_storage::StorageType::Session, &origin);
        0
    })?;
    js_engine.add_callback("__sessionStorage_length", || -> i32 {
        let origin = get_current_origin();
        web_storage::storage_length(web_storage::StorageType::Session, &origin) as i32
    })?;
    js_engine.add_callback("__sessionStorage_key", |index: i32| -> String {
        let origin = get_current_origin();
        if index < 0 {
            return String::new();
        }
        web_storage::storage_key(web_storage::StorageType::Session, &origin, index as u32)
            .unwrap_or_default()
    })?;

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

        // document.cookie getter/setter
        Object.defineProperty(document, 'cookie', {
            get: function() { return __cookie_get(); },
            set: function(val) { __cookie_set(val); },
            configurable: true
        });

        // localStorage object
        var localStorage = {
            getItem: function(key) {
                var val = __localStorage_getItem(key);
                return val === '' ? null : val;
            },
            setItem: function(key, value) { __localStorage_setItem(key, value); },
            removeItem: function(key) { __localStorage_removeItem(key); },
            clear: function() { __localStorage_clear(); },
            get length() { return __localStorage_length(); },
            key: function(i) {
                var k = __localStorage_key(i);
                return k === '' ? null : k;
            }
        };

        // sessionStorage object
        var sessionStorage = {
            getItem: function(key) {
                var val = __sessionStorage_getItem(key);
                return val === '' ? null : val;
            },
            setItem: function(key, value) { __sessionStorage_setItem(key, value); },
            removeItem: function(key) { __sessionStorage_removeItem(key); },
            clear: function() { __sessionStorage_clear(); },
            get length() { return __sessionStorage_length(); },
            key: function(i) {
                var k = __sessionStorage_key(i);
                return k === '' ? null : k;
            }
        };

        var window = {
            document: document, console: console,
            localStorage: localStorage,
            sessionStorage: sessionStorage,
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
