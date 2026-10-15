# Strapi 服务

本项目由 Codex 生成，包含 Strapi 内容管理后台、Astro 静态宣传站、产品下载 API 和 Docker Compose 部署配置。

此目录部署 Strapi 5.58.0、Node.js 22 和 PostgreSQL 17，使用 Docker Compose 以生产模式运行。

## 访问

- 示例宣传站：http://localhost:8080
- 管理后台：http://localhost:1337/admin
- 健康检查：http://localhost:1337/_health
- 第一次访问管理后台时创建管理员账户。
- 后台已启用简体中文和繁体中文。登录后在左下角个人资料的 Interface language 中选择中文并保存。

已配置「首页与网站设置」「推广帖子」「招聘岗位」「产品发布」四个运营模块，并提供示例内容。详细操作见 [OPERATIONS.md](OPERATIONS.md)。
网站使用 Astro 静态生成已发布的内容。运营无需手动构建：发布、下架或删除后自动更新网站。下载信息和文件下载在访问时调用后台 API。

默认端口只绑定本机 `127.0.0.1`。远程访问可通过 SSH 转发：

```sh
ssh -L 1337:127.0.0.1:1337 ubuntu@服务器地址
```

需要公开站点时，配置域名、HTTPS 反向代理和 Strapi 的公开 URL。

## 管理服务

在此目录执行：

```sh
docker compose up -d --build   # 构建并启动；修改代码后也使用此命令
docker compose ps            # 查看运行及健康状态
docker compose logs -f strapi # 查看日志
docker compose restart strapi # 重启 Strapi
docker compose down          # 停止，保留数据卷
```

容器设置了 `restart: unless-stopped`，Docker 启动时会恢复未主动停止的服务。
内容类型的创建和修改需要在开发模式完成，之后重新构建部署；生产后台不提供内容类型编辑功能。

## 数据和密钥

- `strapi_postgres_data` 数据卷保存数据库。
- `strapi_uploads` 数据卷保存上传文件。
- `.env` 保存随机生成的数据库密码和应用密钥，权限为 `600`，不会复制进镜像。
- `package-lock.json` 锁定依赖安装版本。
- 保管 `.env` 并与数据库、上传文件一起备份；不要在已有数据时随意重新生成密钥。
- **不要执行 `docker compose down -v`**，它会删除数据卷。

数据库备份：

```sh
mkdir -p backups
chmod 700 backups
docker compose exec -T postgres pg_dump -U strapi -d strapi -Fc > backups/strapi.dump
chmod 600 backups/strapi.dump
```

上传文件备份（保持数据库与上传文件备份时间一致）：

```sh
docker compose cp strapi:/opt/app/public/uploads backups/uploads
```

官方文档：https://docs.strapi.io/cms/deployment
