# 新星防御 (Nova Defense)

一个基于 React + Vite + Tailwind CSS 开发的经典导弹指挥官风格塔防游戏。

## 部署到 Vercel

本项目已针对 Vercel 进行优化。你可以通过以下步骤快速部署：

1. **上传到 GitHub**: 将代码推送到你的 GitHub 仓库。
2. **连接 Vercel**: 在 Vercel 控制台中导入该仓库。
3. **配置环境变量**:
   - 在 Vercel 的项目设置 (Project Settings) -> Environment Variables 中添加：
     - `GEMINI_API_KEY`: 你的 Google AI SDK 密钥（如果游戏中使用了 AI 功能）。
4. **部署**: 点击部署，Vercel 会自动识别 Vite 配置并完成构建。

## 技术栈

- **前端框架**: React 19
- **动画库**: Motion (Framer Motion)
- **图标**: Lucide React
- **构建工具**: Vite
- **样式**: Tailwind CSS 4.0

## 游戏玩法

- **目标**: 保护城市和炮台免受下落火箭的袭击。
- **操作**: 点击屏幕发射拦截导弹。
- **得分**: 击毁敌方火箭获得积分，达到 1000 分获胜。
- **难度**: 支持简单、普通、困难三种模式。
