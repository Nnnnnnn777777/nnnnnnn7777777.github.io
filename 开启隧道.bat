@echo off
chcp 65001 >nul
title 数字分身隧道 - 关闭此窗口即断开公网访问
echo 正在开启公网隧道...
echo.
echo 稍等几秒，下面会出现一行 https://xxxx.trycloudflare.com 的网址
echo 那就是发给别人的公网地址（每次重启网址都会变）
echo.
echo 注意：先用「启动分身.bat」把服务开起来，再开本隧道
echo.
"C:\Users\联想\AppData\Local\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000
pause
