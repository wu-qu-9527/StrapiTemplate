FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/healthz && test -s /site/current/index.html || exit 1
