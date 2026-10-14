# Astro 宣传站

前台使用 Astro 7.3.8，`output: static`。首页、产品、帖子、岗位正文在构建时写入 HTML，浏览器无需请求 CMS 才能阅读。

页面路径：

- `/`：首页
- `/products/<slug>/`：产品介绍
- `/posts/<slug>/`：帖子正文
- `/jobs/<slug>/`：岗位详情
- `/downloads/`：下载中心
- `/downloads/<slug>/`：产品下载页

下载中心和下载页保留浏览器脚本，从同源 `/api/website/` 调用 Strapi API。下载文件按钮也指向 API，后台每次检查产品发布状态，然后发送本地文件附件，或跳转到运营配置的外部链接。这里无需用户登录，仅公开已发布产品的下载。

## 自动更新

`site-builder` 在 Docker 内网运行，没有映射宿主机端口。Strapi 在发布、取消发布和删除内容后通知它，使用 `.env` 中 `SITE_BUILD_TOKEN` 验证。构建服务每 30 秒检查一次已发布内容作为失败重试与补偿；仅内容变动时生成新版。

构建会读取受保护的 `/api/website/snapshot`，将一次内容快照传给 Astro。此快照只包含已发布的页面内容，不含下载地址和应用密钥。后台分页读取全部已发布内容；成功构建后通过符号链接原子切换到新目录，失败保留旧版。保留最近三版输出，新版保留上一版的静态资源以避免已有页面资源失效。

`strapi_site_output` 数据卷存储生成页面；Nginx 只读挂载该卷。

发布后的页面更新时间通常为数秒，另需考虑当前构建和 30 秒补偿间隔。下载 API 无需等待静态构建；产品下架后下载 API 立即拒绝访问。

## 维护

项目根目录执行：

```sh
docker compose up -d --build --wait
docker compose logs -f site-builder
docker compose exec -T site-builder cat /site/build-status.json
```

查看日志和状态能发现构建失败。目前没有接入邮件或外部告警渠道。

手动请求重新检查（不打印密钥）：

```sh
docker compose exec -T site-builder node -e "fetch('http://127.0.0.1:4322/rebuild',{method:'POST',headers:{'x-site-build-token':process.env.SITE_BUILD_TOKEN}}).then(r=>console.log(r.status))"
```

重启 `site-builder` 会重新构建一次，可用于应用模板更新。`.content/` 和 `dist/` 为生成目录，不提交到版本控制。

本地开发需先获取已发布快照到 `.content/snapshot.json`。不要把下载中心改成静态生成文件地址：下载信息和授权检查始终走后台 API。

## 下载文件说明

上传文件保存在原有 `strapi_uploads` 卷，备份时与数据库一起备份。通过 Nginx 和 Strapi 上传时最大 200MB，超过此大小使用对象存储或 CDN 的 HTTPS 链接。

此站提供公开产品下载，并非私有文件库；Strapi 媒体文件的原始 `/uploads/` 地址仍可公开访问。下载按钮走 API 的发布状态检查。若需要用户登录、付费授权或撤销已知原始地址，需要另行配置私有存储和访问授权。
