# 部署到 Render / Deploy to Render

本 `ufo_site/` 目录是自包含的 Git 项目，可通过 [Render Blueprint](https://render.com/docs/blueprint-spec) 一键部署。

## 仓库结构（git 跟踪的全部文件）

```
ufo_site/                                  ← git 根目录
├── .gitignore
├── render.yaml                            ← Render Blueprint 配置
├── requirements-build.txt                 ← 构建期 Python 依赖
├── README.md                              ← 启动说明
├── DEPLOY.md                              ← 本文件
├── records.json                           ← war.gov URL 映射（225 KB）
├── index.html                             ← 网站首页
├── about.html                             ← 关于页
├── css/style.css
├── js/
│   ├── app.js
│   └── i18n.js
├── data/
│   ├── manifest.json                      ← 列出所有事件批次
│   ├── geocode.json                       ← 地点 → 经纬度
│   ├── cities_heatmap.json                ← 人类活动 heatmap（820 KB）
│   └── events/
│       └── batch_001_dow_release_01_2026-05-08.json
├── archives/                              ← 本地开发用的符号链接（gitignored）
└── scripts/
    ├── prepare_for_render.py              ← 部署前预处理（外链化 archive_url）
    └── add_event.py                       ← 命令行添加新事件
```

## 一、初始化 Git 仓库

第一次发布到 GitHub：

```bash
cd ufo_site                                 # 进入这个目录（git 根）
git init
git add .
git commit -m "Initial: UFO/UAP interactive map"

# 在 GitHub 上新建一个 repo，然后：
git branch -M main
git remote add origin git@github.com:你的用户名/ufo-map.git
git push -u origin main
```

## 二、在 Render 上部署

### Blueprint 方式（推荐）

1. 登录 [render.com](https://render.com)
2. **New** → **Blueprint**
3. 连接 GitHub 仓库（选你刚创建的 ufo-map repo）
4. Render 自动识别 `render.yaml`，列出 service
5. **Apply** → 等待 1-2 分钟构建完成

得到地址：`https://ufo-uap-map-XXXX.onrender.com`

### 手动创建 Static Site（不用 Blueprint）

1. **New** → **Static Site**
2. 连接仓库
3. 设置：
   - **Build Command**: `python3 scripts/prepare_for_render.py`
   - **Publish Directory**: `./` （或留空，默认为仓库根）
4. **Create Static Site**

## 三、本地预览

```bash
cd ufo_site                                 # 进入 git 根
python3 -m http.server 9876                # 启动本地服务器
# 浏览器打开 http://localhost:9876
```

如果你想看部署后的样子（archive_url 指向 war.gov）：

```bash
python3 scripts/prepare_for_render.py      # 改写 archive_url
python3 -m http.server 9876
# 详情页 → "打开原始档案" 跳到 war.gov
```

archive 符号链接（用于本地访问原 PDF）需要手动初始化：

```bash
# 如果你的原始 PDF 在 ~/Downloads/UFO_originals/pdfs/ 等位置
cd ufo_site/archives
ln -s ~/Downloads/UFO_originals/pdfs    pdfs
ln -s ~/Downloads/UFO_originals/videos  videos
ln -s ~/Downloads/UFO_originals/images  images
# ...
```

## 四、添加新事件

### 单条事件 — 命令行

```bash
python3 scripts/add_event.py \
  --batch batch_002 \
  --date 2026-12-15 \
  --location "Roswell, New Mexico" \
  --lat 33.3943 --lon -104.5230 \
  --agency FBI \
  --type PDF \
  --title "新事件描述" \
  --source "FBI File XYZ-123, p.5" \
  --file "new_report.pdf" \
  --archive-url "https://www.war.gov/medialink/ufo/release_2/new_report.pdf"
```

### 单条事件 — 交互式

```bash
python3 scripts/add_event.py
# 跟随提示逐项输入
```

### 批量导入 Release 02、03 等

```bash
# 准备 JSON 数组（每项 = 一个事件，结构见 about.html）
python3 scripts/add_event.py \
  --import /tmp/release_02_events.json \
  --batch batch_002 \
  --batch-name "DoW UFO/UAP Release 02" \
  --release-date 2026-11-01
```

### 提交 & 部署

```bash
git add data/                              # 只需要提交 data/ 改动
git commit -m "Add Release 02 events"
git push                                    # Render 自动重新构建（~1 分钟）
```

## 五、自定义域名

编辑 `render.yaml`，在 service 下加：

```yaml
domains:
  - ufo-map.yourdomain.com
```

或在 Render Dashboard：Settings → Custom Domains → Add Custom Domain → 配 DNS CNAME。

## 六、监控

- **Logs**：Dashboard → Service → Logs
- **Metrics**：Dashboard → Metrics（带宽、请求数）
- **Build status**：Dashboard → Deploys（每次构建的详细日志）

## 已知限制

- **Render 免费档**：100 GB 带宽/月、400 构建分钟。本站只有 ~2 MB，绰绰有余。
- **原始档案来自 war.gov**：用户点「打开原始档案」会跳 war.gov，依赖其可用性。
- **archives/ 符号链接**：仅本地有效；Render 部署时被自动忽略。
