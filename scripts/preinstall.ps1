# PowerShell 版本的 preinstall 脚本
if (!(Test-Path "config.json")) {
    Copy-Item "config.example.json" "config.json"
}
if (!(Test-Path "builder.config.ts")) {
    Copy-Item "builder.config.default.ts" "builder.config.ts"
}
