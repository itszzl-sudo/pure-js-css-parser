use anyhow::{anyhow, Result};
use log::{debug, error, info, warn};
use quickjs_rusty::{Context, OwnedJsValue, OwnedJsObject};
use std::cell::RefCell;

/// JavaScript 引擎封装 - 基于 QuickJS-NG (QuickJS Next Gen)
///
/// 提供完整的 JavaScript 执行环境，支持：
/// - ES2020+ 语法（箭头函数、async/await、解构、class、模板字符串等）
/// - console.log/error/warn/info/debug
/// - Promise / async-await
/// - setTimeout / setInterval (stub)
/// - DOM API 回调
/// - 模块加载
pub struct JsEngine {
    context: Context,
    console_logs: RefCell<Vec<String>>,
}

impl JsEngine {
    pub fn new() -> Result<Self> {
        info!("Initializing QuickJS-NG engine...");
        let context = Context::builder()
            .memory_limit(256 * 1024 * 1024)
            .build()
            .map_err(|e| anyhow!("Failed to create QuickJS context: {:?}", e))?;

        let mut engine = Self {
            context,
            console_logs: RefCell::new(Vec::new()),
        };
        engine.init_globals()?;
        info!("QuickJS-NG engine initialized successfully");
        Ok(engine)
    }

    fn init_globals(&mut self) -> Result<()> {
        self.context.add_callback("console_log", |msg: String| -> i32 { info!("[JS] {}", msg); 0 })
            .map_err(|e| anyhow!("{:?}", e))?;
        self.context.add_callback("console_error", |msg: String| -> i32 { error!("[JS] {}", msg); 0 })
            .map_err(|e| anyhow!("{:?}", e))?;
        self.context.add_callback("console_warn", |msg: String| -> i32 { warn!("[JS] {}", msg); 0 })
            .map_err(|e| anyhow!("{:?}", e))?;

        self.eval(
            r#"
            var console = {
                log:   function() { console_log(Array.prototype.slice.call(arguments).map(String).join(' ')); },
                error: function() { console_error(Array.prototype.slice.call(arguments).map(String).join(' ')); },
                warn:  function() { console_warn(Array.prototype.slice.call(arguments).map(String).join(' ')); },
                info:  function() { console_log(Array.prototype.slice.call(arguments).map(String).join(' ')); },
                debug: function() { console_log(Array.prototype.slice.call(arguments).map(String).join(' ')); }
            };
            var __timer_id = 0;
            function setTimeout(cb, d) { return ++__timer_id; }
            function clearTimeout(id) {}
            function setInterval(cb, d) { return ++__timer_id; }
            function clearInterval(id) {}
            "#,
            false,
        )?;
        Ok(())
    }

    pub fn eval(&self, code: &str, resolve_promise: bool) -> Result<OwnedJsValue> {
        debug!("Evaluating JS ({} bytes)", code.len());
        self.context.eval(code, resolve_promise)
            .map_err(|e| anyhow!("JS error: {:?}", e))
    }

    pub fn eval_as<T>(&self, code: &str) -> Result<T>
    where
        T: TryFrom<OwnedJsValue>,
        T::Error: Into<quickjs_rusty::ValueError>,
    {
        self.context.eval_as::<T>(code)
            .map_err(|e| anyhow!("JS error: {:?}", e))
    }

    pub fn eval_as_string(&self, code: &str) -> Result<String> {
        let value = self.eval(code, false)?;
        value.to_string().map_err(|e| anyhow!("{:?}", e))
    }

    pub fn set_global<T>(&self, name: &str, value: T) -> Result<()>
    where T: quickjs_rusty::ToOwnedJsValue {
        self.context.set_global(name, value).map_err(|e| anyhow!("{:?}", e))
    }

    pub fn global(&self) -> Result<OwnedJsObject> {
        self.context.global().map_err(|e| anyhow!("{:?}", e))
    }

    pub fn add_callback<'a, F>(
        &self,
        name: &str,
        callback: impl quickjs_rusty::Callback<F> + 'static,
    ) -> Result<()> {
        self.context.add_callback(name, callback).map_err(|e| anyhow!("{:?}", e))
    }

    pub fn call_function(
        &self, name: &str,
        args: impl IntoIterator<Item = impl quickjs_rusty::ToOwnedJsValue>,
    ) -> Result<OwnedJsValue> {
        self.context.call_function(name, args).map_err(|e| anyhow!("{:?}", e))
    }

    pub fn execute_pending_jobs(&self) -> Result<()> {
        self.context.execute_pending_job().map_err(|e| anyhow!("{:?}", e))
    }

    pub fn get_console_logs(&self) -> Vec<String> { self.console_logs.borrow().clone() }
}

impl Default for JsEngine {
    fn default() -> Self { Self::new().expect("Failed to create JsEngine") }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_creation() { assert!(JsEngine::new().is_ok()); }

    #[test]
    fn test_number() { assert_eq!(JsEngine::new().unwrap().eval_as::<i32>("42").unwrap(), 42); }

    #[test]
    fn test_string() { assert_eq!(JsEngine::new().unwrap().eval_as::<String>("'hello'").unwrap(), "hello"); }

    #[test]
    fn test_arrow() { assert_eq!(JsEngine::new().unwrap().eval_as::<i32>("((a,b)=>a+b)(3,7)").unwrap(), 10); }

    #[test]
    fn test_closure() {
        assert_eq!(JsEngine::new().unwrap().eval_as::<i32>(
            "var c=0; var f=()=>++c; f(); f(); f();"
        ).unwrap(), 3);
    }

    #[test]
    fn test_class() {
        assert_eq!(JsEngine::new().unwrap().eval_as::<i32>(
            "class A{constructor(n){this.n=n}g(){return this.n}} new A(42).g()"
        ).unwrap(), 42);
    }

    #[test]
    fn test_promise() { assert_eq!(JsEngine::new().unwrap().eval_as::<i32>("Promise.resolve(42)").unwrap(), 42); }

    #[test]
    fn test_async() {
        assert_eq!(JsEngine::new().unwrap().eval_as::<String>(
            "async function f(){return 'ok'} f()"
        ).unwrap(), "ok");
    }

    #[test]
    fn test_callback() {
        let e = JsEngine::new().unwrap();
        e.add_callback("add", |a: i32, b: i32| -> i32 { a + b }).unwrap();
        assert_eq!(e.eval_as::<i32>("add(10,20)").unwrap(), 30);
    }
}
