use anyhow::{anyhow, Result};
use log::info;
use std::collections::HashMap;
use std::io::Read;
use url::Url;

/// HTTP 响应
#[derive(Debug, Clone)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
    pub content_type: String,
}

impl HttpResponse {
    pub fn text(&self) -> Result<String> {
        String::from_utf8(self.body.clone())
            .map_err(|e| anyhow!("Invalid UTF-8 in response: {}", e))
    }
}

/// 网络管理器
pub struct NetworkManager;

impl NetworkManager {
    pub fn new() -> Self {
        Self
    }

    /// 发送 HTTP GET 请求
    pub fn get(&self, url: &str) -> Result<HttpResponse> {
        info!("HTTP GET: {}", url);
        
        let response = ureq::get(url)
            .call()
            .map_err(|e| anyhow!("HTTP GET failed: {}", e))?;

        let status = response.status();
        let content_type = response
            .header("Content-Type")
            .unwrap_or("text/html")
            .to_string();

        let mut headers = HashMap::new();
        for name in response.headers_names() {
            if let Some(value) = response.header(&name) {
                headers.insert(name, value.to_string());
            }
        }

        let mut body = Vec::new();
        response.into_reader().read_to_end(&mut body)?;

        info!("HTTP GET completed: status={}, bytes={}", status, body.len());

        Ok(HttpResponse {
            status,
            headers,
            body,
            content_type,
        })
    }

    /// 发送 HTTP POST 请求
    pub fn post(&self, url: &str, data: &[u8], content_type: &str) -> Result<HttpResponse> {
        info!("HTTP POST: {} ({} bytes)", url, data.len());

        let response = ureq::post(url)
            .set("Content-Type", content_type)
            .send_bytes(data)
            .map_err(|e| anyhow!("HTTP POST failed: {}", e))?;

        let status = response.status();
        let response_content_type = response.header("Content-Type").unwrap_or("text/html").to_string();
        
        let mut headers = HashMap::new();
        for name in response.headers_names() {
            if let Some(value) = response.header(&name) {
                headers.insert(name, value.to_string());
            }
        }

        let mut body = Vec::new();
        response.into_reader().read_to_end(&mut body)?;

        info!("HTTP POST completed: status={}", status);

        Ok(HttpResponse {
            status,
            headers,
            body,
            content_type: response_content_type,
        })
    }

    /// 获取资源内容
    pub fn fetch(&self, url: &str) -> Result<Resource> {
        let parsed_url = Url::parse(url)?;
        
        match parsed_url.scheme() {
            "http" | "https" => {
                let response = self.get(url)?;
                Ok(Resource::Http(response))
            }
            "file" => {
                let path = parsed_url.path();
                let content = std::fs::read(path)?;
                Ok(Resource::File {
                    path: path.to_string(),
                    content,
                })
            }
            "data" => {
                // data:text/html,<html>...</html>
                let data = parsed_url.path();
                let parts: Vec<&str> = data.splitn(2, ',').collect();
                if parts.len() == 2 {
                    let mime = parts[0];
                    let content = if mime.ends_with(";base64") {
                        base64_decode(parts[1])?
                    } else {
                        // data URL 中的内容需要 URL 解码（如 %23 -> #）
                        let decoded = urlencoding::decode(parts[1])
                            .map_err(|e| anyhow!("URL decode failed: {}", e))?;
                        decoded.as_bytes().to_vec()
                    };
                    Ok(Resource::Data {
                        mime: mime.to_string(),
                        content,
                    })
                } else {
                    Err(anyhow!("Invalid data URL"))
                }
            }
            _ => Err(anyhow!("Unsupported URL scheme: {}", parsed_url.scheme())),
        }
    }
}

impl Default for NetworkManager {
    fn default() -> Self {
        Self::new()
    }
}

/// 资源类型
#[derive(Debug, Clone)]
pub enum Resource {
    Http(HttpResponse),
    File { path: String, content: Vec<u8> },
    Data { mime: String, content: Vec<u8> },
}

impl Resource {
    pub fn text(&self) -> Result<String> {
        match self {
            Resource::Http(resp) => resp.text(),
            Resource::File { content, .. } => {
                String::from_utf8(content.clone())
                    .map_err(|e| anyhow!("Invalid UTF-8: {}", e))
            }
            Resource::Data { content, .. } => {
                String::from_utf8(content.clone())
                    .map_err(|e| anyhow!("Invalid UTF-8: {}", e))
            }
        }
    }

    pub fn bytes(&self) -> Vec<u8> {
        match self {
            Resource::Http(resp) => resp.body.clone(),
            Resource::File { content, .. } => content.clone(),
            Resource::Data { content, .. } => content.clone(),
        }
    }

    pub fn content_type(&self) -> String {
        match self {
            Resource::Http(resp) => resp.content_type.clone(),
            Resource::File { path, .. } => {
                guess_mime_type(path)
            }
            Resource::Data { mime, .. } => mime.clone(),
        }
    }
}

fn guess_mime_type(path: &str) -> String {
    let ext = std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    match ext.to_lowercase().as_str() {
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" => "application/javascript",
        "json" => "application/json",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    }
    .to_string()
}

fn base64_decode(input: &str) -> Result<Vec<u8>> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    STANDARD.decode(input.trim())
        .map_err(|e| anyhow!("Base64 decode error: {}", e))
}
