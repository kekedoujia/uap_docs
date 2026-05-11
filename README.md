# 🛸 UFO/UAP Interactive Map

基于美国战争部 (Department of War) 2026-05-08 公开 UFO/UAP 解密档案 Release 01 构建的可交互地图站点。

**自包含的 Git 项目**——这个目录就是一个完整的可部署仓库。

## 在线访问

部署到 Render 后可通过 `https://<your-service>.onrender.com` 访问。
本地预览见下方「快速启动」。

## 快速启动（本地）

```bash
python3 -m http.server 9876
# 浏览器打开: http://localhost:9876
```

> 必须通过 HTTP 服务器访问——浏览器禁止 `file://` 协议下加载 JSON。

## 站点功能

- 🗺️ **Leaflet 暗色世界地图** + 国界线（CARTO Dark）
- 🔥 **人类活动 heatmap**：33,604 个 GeoNames 城市点，按人口对数加权
- 📍 **事件标点**：按报告机构着色（FBI 黄 / USAF 绿 / DoW 蓝 / NASA 橙）
- 🖱️ **悬停**：日期 + 地点 + 机构简要索引
- 👆 **点击**：弹窗摘要 + 按钮打开详情面板
- 📄 **详情面板**：完整字段 + **打开原始档案**链接（指向 war.gov）
- 🌐 **中英双语切换**：右上角 中 / EN 按钮
- 🔍 **筛选器**：时间范围、报告机构、UAP 类型、图层开关、聚合开关、heatmap 强度
- 📊 **实时统计**：当前可见事件数 + 按地区分布

## 目录结构

```
.
├── render.yaml                            # Render Blueprint
├── requirements-build.txt                 # 构建期依赖
├── records.json                           # war.gov URL 映射
├── index.html                             # 主地图页
├── about.html                             # 关于页
├── css/style.css
├── js/
│   ├── app.js                             # 主应用
│   └── i18n.js                            # 中英文翻译字典
├── data/
│   ├── manifest.json                      # 列出所有事件批次
│   ├── geocode.json                       # 地点 → 经纬度
│   ├── cities_heatmap.json                # heatmap 数据 (820KB)
│   └── events/
│       └── batch_001_dow_release_01_2026-05-08.json
├── archives/                              # 本地用符号链接 (gitignored)
└── scripts/
    ├── prepare_for_render.py              # 部署前预处理
    └── add_event.py                       # 添加事件 CLI
```

## 添加新事件

详见 [DEPLOY.md](DEPLOY.md#四添加新事件)。简版：

```bash
python3 scripts/add_event.py \
  --batch batch_002 \
  --date 2026-12-15 \
  --location "Some City, Country" \
  --lat 33.39 --lon -104.52 \
  --agency FBI --type PDF \
  --title "事件描述" \
  --archive-url "https://www.war.gov/medialink/..."
```

或交互式：

```bash
python3 scripts/add_event.py
```

## 部署到 Render

详见 [DEPLOY.md](DEPLOY.md)。简版：

```bash
git init && git add . && git commit -m "Initial"
git remote add origin git@github.com:USER/ufo-map.git
git push -u origin main
# 然后到 render.com → New → Blueprint → 连接仓库 → Apply
```

## 数据来源

- 主数据：[https://www.war.gov/UFO/](https://www.war.gov/UFO/)
- 城市人口：[GeoNames cities15000](https://download.geonames.org/export/dump/)
- 地理编码：手工 + [Nominatim](https://nominatim.openstreetmap.org/)
- 底图：[CARTO Dark](https://carto.com/) + OpenStreetMap

## 当前规模

- 事件：175 / 269（已地理编码 / 全部抽取）
- 地点：100 个不重复（已坐标化）
- 时间跨度：1944-2026
- 原始档案：3.7 GB（从 war.gov 链接，未存仓库内）
