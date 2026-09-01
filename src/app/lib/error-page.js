// Function to generate the error HTML string
function generateErrorHtml (port) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Connection Error</title>
      <style>
        body {
          font-family: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
          margin: 40px auto;
          max-width: 720px;
          line-height: 1.7;
          background: #0f141d;
          color: #e6edf5;
        }
        h1 {
          color: #ffb454;
          font-size: 20px;
          letter-spacing: 2px;
        }
        .section {
          margin-bottom: 32px;
          padding: 24px 28px;
          border: 1px solid #2a3547;
          border-radius: 8px;
          background: #151c28;
        }
        ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        li {
          margin: 6px 0;
          color: #8b98ab;
        }
        .chinese {
          font-family: 'Noto Sans SC', 'IBM Plex Mono', sans-serif;
        }
        img {
          max-width: 200px;
          border-radius: 6px;
        }
      </style>
    </head>
    <body>
      <div class="section">
        <h1>Connection Issue Detected</h1>
        <p>Unable to connect to the local server at http://127.0.0.1:${port}. This is often caused by applications (such as proxy software, VPNs, or network tools) intercepting or blocking localhost (127.0.0.1) traffic.</p>
        <p><strong>Suggested fixes:</strong></p>
        <ul>
          <li>Check if proxy software (e.g., Proxifier) is running. Ensure it excludes localhost (127.0.0.1) or this app's executable from proxying.</li>
          <li>Verify that VPNs or other network tools are not redirecting localhost traffic.</li>
          <li>Check firewall rules or antivirus software that might block local ports.</li>
        </ul>
        <p>Restart the app after making changes. If the problem persists, contact author: zxdong@gmail.com.</p>
      </div>

      <div class="section chinese">
        <h1>检测到连接问题</h1>
        <p>无法连接到本地服务器 http://127.0.0.1:${port}。这通常是由于应用程序（如代理软件、VPN 或网络工具）拦截或阻止了本地 (127.0.0.1) 流量。</p>
        <p><strong>建议的解决方法：</strong></p>
        <ul>
          <li>检查是否正在运行代理软件（如 Proxifier）。确保其设置排除本地连接 (127.0.0.1) 或此应用程序的可执行文件。</li>
          <li>确认 VPN 或其他网络工具未重定向本地流量。</li>
          <li>检查防火墙规则或防病毒软件是否阻止了本地端口。</li>
        </ul>
        <p>更改设置后重启应用程序。如果问题仍然存在，请联系作者：zxdong@gmail.com。</p>
        <p>
          <img
            src='https://electerm.org/electerm-wechat-group-qr.jpg'
          />
        </p>
      </div>
    </body>
    </html>
  `
}

module.exports = generateErrorHtml
