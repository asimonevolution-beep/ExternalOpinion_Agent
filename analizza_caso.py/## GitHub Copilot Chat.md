## GitHub Copilot Chat

- Extension: 0.48.1 (prod)
- VS Code: 1.120.0 (0958016b2af9f09bb4257e0df4a95e2f90590f9f)
- OS: win32 10.0.26200 x64
- GitHub Account: asimonevolution-beep

## Network

User Settings:
```json
  "http.systemCertificatesNode": true,
  "github.copilot.advanced.debug.useElectronFetcher": true,
  "github.copilot.advanced.debug.useNodeFetcher": false,
  "github.copilot.advanced.debug.useNodeFetchFetcher": true
```

Connecting to https://api.github.com:
- DNS ipv4 Lookup: 140.82.121.5 (1 ms)
- DNS ipv6 Lookup: Error (7279 ms): getaddrinfo ENOTFOUND api.github.com
- Proxy URL: None (2 ms)
- Electron fetch (configured): timed out after 10 seconds
- Node.js https: timed out after 10 seconds
- Node.js fetch: timed out after 10 seconds

Connecting to https://api.githubcopilot.com/_ping:
- DNS ipv4 Lookup: timed out after 10 seconds
- DNS ipv6 Lookup: Error (7271 ms): getaddrinfo ENOTFOUND api.githubcopilot.com
- Proxy URL: None (16 ms)
- Electron fetch (configured): HTTP 200 (446 ms)
- Node.js https: HTTP 200 (860 ms)
- Node.js fetch: HTTP 200 (3098 ms)

Connecting to https://copilot-proxy.githubusercontent.com/_ping:
- DNS ipv4 Lookup: 20.250.119.64 (35 ms)
- DNS ipv6 Lookup: Error (42 ms): getaddrinfo ENOTFOUND copilot-proxy.githubusercontent.com
- Proxy URL: None (34 ms)
- Electron fetch (configured): HTTP 200 (161 ms)
- Node.js https: HTTP 200 (1584 ms)
- Node.js fetch: HTTP 200 (427 ms)

Connecting to https://mobile.events.data.microsoft.com: HTTP 404 (1991 ms)
Connecting to https://dc.services.visualstudio.com: HTTP 404 (270 ms)
Connecting to https://copilot-telemetry.githubusercontent.com/_ping: HTTP 200 (591 ms)
Connecting to https://copilot-telemetry.githubusercontent.com/_ping: HTTP 200 (475 ms)
Connecting to https://default.exp-tas.com: HTTP 400 (232 ms)

Number of system certificates: 55

## Documentation

In corporate networks: [Troubleshooting firewall settings for GitHub Copilot](https://docs.github.com/en/copilot/troubleshooting-github-copilot/troubleshooting-firewall-settings-for-github-copilot).