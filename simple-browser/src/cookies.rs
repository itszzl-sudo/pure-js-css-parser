//! Cookie 模块 — 独立的 Cookie 管理
//!
//! 从 rust-browser/src/network.rs 提取的 Cookie 相关功能。
//! 符合 RFC 6265 规范，使用全局 Cookie jar。

use log::info;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use url::Url;

use lazy_static::lazy_static;

lazy_static! {
    /// 全局默认 Cookie 存储
    pub static ref GLOBAL_COOKIE_JAR: SharedCookieJar =
        Arc::new(Mutex::new(HashMap::new()));
}

/// 共享 Cookie jar 类型
pub type SharedCookieJar = Arc<Mutex<HashMap<String, CookieEntry>>>;

/// Cookie 条目，符合 RFC 6265 规范
#[derive(Clone, Debug)]
#[allow(dead_code)]
pub struct CookieEntry {
    pub name: String,
    pub value: String,
    pub domain: String,
    pub path: String,
    pub secure: bool,
    pub http_only: bool,
    pub expires: Option<Instant>,
}

impl CookieEntry {
    /// 检查 cookie 是否已过期
    pub fn is_expired(&self) -> bool {
        self.expires.is_some_and(|exp| Instant::now() > exp)
    }
}

/// 从全局 Cookie jar 中获取与给定 URL 匹配的 Cookie 字符串
pub fn get_cookies(url: &Url) -> String {
    let host = url.host_str().unwrap_or("");
    let path = url.path();

    if let Ok(mut jar) = GLOBAL_COOKIE_JAR.lock() {
        // 先清理过期 cookie
        jar.retain(|_, entry| !entry.is_expired());

        let mut cookies = Vec::new();
        for (_, entry) in jar.iter() {
            if entry.domain == host && path.starts_with(&entry.path)
                && (!entry.secure || url.scheme() == "https") {
                    cookies.push(format!("{}={}", entry.name, entry.value));
                }
        }
        return cookies.join("; ");
    }
    String::new()
}

/// 解析 `Set-Cookie` 响应头，符合 RFC 6265
pub fn parse_set_cookie(header: &str, request_url: &Url) {
    // RFC 6265 § 5.2: Set-Cookie 的分隔符是 ";"
    let parts: Vec<&str> = header.split(';').collect();
    if parts.is_empty() {
        return;
    }

    // ---- 解析 name=value（值可能包含 "=" 号） ----
    let name_value_str = parts[0];
    let eq_pos = name_value_str.find('=');
    let (name, value) = match eq_pos {
        Some(pos) => (
            name_value_str[..pos].trim().to_string(),
            name_value_str[pos + 1..].trim().to_string(),
        ),
        None => return, // 没有 "=" 不合法
    };

    // 默认值
    let request_host = request_url.host_str().unwrap_or("").to_string();
    let mut domain = request_host.clone();
    let mut path = request_url.path().to_string();
    let mut secure = false;
    let mut http_only = false;
    let mut expires: Option<Instant> = None;

    // 解析各个属性（RFC 6265 § 5.2）
    for attr in &parts[1..] {
        let attr = attr.trim();
        if attr.is_empty() {
            continue;
        }

        let attr_lower = attr.to_lowercase();
        if attr_lower == "secure" {
            secure = true;
        } else if attr_lower == "httponly" {
            http_only = true;
        } else if let Some(val) = attr_lower.strip_prefix("domain=") {
            let val = val.trim();
            // RFC 6265 § 5.2.3: 后置点号去除
            let val = val.strip_prefix('.').unwrap_or(val);
            // 检查 domain 是否匹配请求 host 尾部
            if request_host.ends_with(&format!(".{}", val)) || request_host == val {
                domain = val.to_string();
            }
            // 不匹配则忽略 Domain 属性
        } else if let Some(val) = attr_lower.strip_prefix("path=") {
            let val = val.trim();
            if val.starts_with('/') || val.starts_with("//") {
                path = val.to_string();
            } else {
                // RFC 6265 § 5.2.4: 不以 '/' 开头使用 default-path
                path = default_path(request_url.path());
            }
        } else if let Some(val) = attr_lower.strip_prefix("max-age=") {
            // Max-Age 优先于 Expires
            if let Ok(seconds) = val.trim().parse::<i64>() {
                if seconds <= 0 {
                    // 立即过期（<=0 时删除 cookie）
                    if let Ok(mut jar) = GLOBAL_COOKIE_JAR.lock() {
                        let key = format!("{}:{}:{}", domain, name, path);
                        jar.remove(&key);
                    }
                    return;
                }
                expires = Some(Instant::now() + Duration::from_secs(seconds as u64));
            }
        } else if let Some(val) = attr.strip_prefix("Expires=") {
            // 如果已设置 Max-Age 则跳过
            if expires.is_none()
                && let Some(exp) = parse_expires(val.trim()) {
                    expires = Some(exp);
                }
        }
    }

    // 修正 path：如果未设置 path 属性，使用 default-path
    if !parts
        .iter()
        .any(|p| p.trim().to_lowercase().starts_with("path="))
    {
        path = default_path(request_url.path());
    }

    let entry = CookieEntry {
        name,
        value,
        domain,
        path,
        secure,
        http_only,
        expires,
    };

    if let Ok(mut jar) = GLOBAL_COOKIE_JAR.lock() {
        let key = format!("{}:{}:{}", entry.domain, entry.name, entry.path);
        jar.insert(key, entry);
    }
}

/// 清除全局 Cookie jar 中的所有 Cookie
pub fn clear_cookies() {
    if let Ok(mut jar) = GLOBAL_COOKIE_JAR.lock() {
        jar.clear();
        info!("Cookie 存储已清空");
    }
}

/// RFC 6265 § 5.1.4: default-path 算法
fn default_path(request_path: &str) -> String {
    if !request_path.starts_with('/') {
        return "/".to_string();
    }
    // 如果路径只有一个 "/"，返回 "/"
    if request_path == "/" {
        return "/".to_string();
    }
    // 找到最后一个 "/" 并取其之前的部分
    if let Some(last_slash) = request_path[..request_path.len() - 1].rfind('/') {
        request_path[..=last_slash].to_string()
    } else {
        "/".to_string()
    }
}

/// 解析 HTTP Date（Expires 属性）
///
/// 使用 `httpdate` crate 解析 RFC 7231 / RFC 1123 / RFC 850 / ANSI C 格式。
fn parse_expires(val: &str) -> Option<Instant> {
    let val = val.trim();
    // httpdate::parse_http_date 返回 std::time::SystemTime
    match httpdate::parse_http_date(val) {
        Ok(system_time) => {
            // 将 SystemTime 转换为 Instant
            let now_sys = std::time::SystemTime::now();
            let now_inst = Instant::now();
            match system_time.duration_since(now_sys) {
                Ok(dur) => Some(now_inst + dur),
                Err(e) => {
                    // system_time 早于 now_sys，说明已过期
                    let past = e.duration();
                    if past <= now_inst.elapsed() {
                        Some(now_inst - past)
                    } else {
                        // 极端情况：回退到 epoch
                        None
                    }
                }
            }
        }
        Err(_) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_path() {
        assert_eq!(default_path("/"), "/");
        assert_eq!(default_path("/foo/bar"), "/foo/");
        assert_eq!(default_path("/foo/bar/baz"), "/foo/bar/");
    }

    #[test]
    fn test_cookie_name_value_with_equals() {
        clear_cookies();
        let url = Url::parse("https://example.com/").unwrap();
        parse_set_cookie("token=abc=def==; Path=/", &url);
        let cookies = get_cookies(&url);
        assert!(
            cookies.contains("token=abc=def=="),
            "cookie value should preserve '=': {}",
            cookies
        );
    }

    #[test]
    fn test_cookie_max_age_zero_removes() {
        clear_cookies();
        let url = Url::parse("https://example.com/").unwrap();
        parse_set_cookie("test=value; Path=/; Max-Age=100", &url);
        let cookies = get_cookies(&url);
        assert!(cookies.contains("test=value"), "cookie should exist: {}", cookies);

        parse_set_cookie("test=value; Path=/; Max-Age=0", &url);
        let cookies = get_cookies(&url);
        assert!(!cookies.contains("test=value"), "cookie should be removed: {}", cookies);
    }

    #[test]
    fn test_clear_cookies() {
        let url = Url::parse("https://example.com/").unwrap();
        parse_set_cookie("temp=data; Path=/", &url);
        clear_cookies();
        let cookies = get_cookies(&url);
        assert!(cookies.is_empty());
    }
}
