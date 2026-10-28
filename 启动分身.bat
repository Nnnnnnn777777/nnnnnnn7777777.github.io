@echo off
chcp 65001 >nul
title 数字分身服务 - 关闭此窗口即下线
cd /d "%~dp0"
set LLM_API_KEY=674d8aa615694fd68ea57fe1369f0edf.Kd8HlBd2GDviygC1
set LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
set LLM_MODEL=glm-4-flash
echo 正在启动数字分身服务...
echo 启动后浏览器打开 http://localhost:3000 即可聊天
echo （关掉这个窗口 = 服务下线）
echo.
node server.js
pause
