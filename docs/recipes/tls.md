# Recipe: TLS with Caddy

`fervo serve` speaks plain HTTP. To reach it from other machines, keep it on localhost and put a TLS proxy in front. [Caddy](https://caddyserver.com) gets and renews certificates by itself, and its defaults suit Fervo: request bodies are streamed with no size limit, which Git pushes need, and responses have no timeout, which long polls (up to 30 s) need.

## Set it up

You need a DNS name pointing at the machine, and ports 80 and 443 open for the certificate challenge.

```caddyfile
# /etc/caddy/Caddyfile
fervo.example.org {
	reverse_proxy 127.0.0.1:8765
}
```

```sh
fervo serve --root /srv/fervo/managed --host 127.0.0.1 --port 8765 --public-url https://fervo.example.org
```

- `--public-url` is the address clones fetch and push Git through. Without it the server would hand out `http://127.0.0.1:8765`.
- Keep `--host 127.0.0.1`, so nothing reaches the server without TLS.
- Clients use the public URL everywhere: `fervo clone https://fervo.example.org ./work`, `fervo runner --remote https://fervo.example.org`.
- For an active health check, add `health_uri /healthz` inside `reverse_proxy`; `/healthz` needs no token.

## Try it locally

Caddy's internal CA stands in for a public one. With Docker:

```sh
fervo serve --root ./managed --port 8765 --public-url https://localhost:8443 &
printf 'localhost:8443 {\n\ttls internal\n\treverse_proxy host.docker.internal:8765\n}\n' > Caddyfile
docker run -d --name caddy -p 8443:8443 -v "$PWD/Caddyfile":/etc/caddy/Caddyfile caddy:2.10
docker exec caddy cat /data/caddy/pki/authorities/local/root.crt > caddy-root.crt
export NODE_EXTRA_CA_CERTS=$PWD/caddy-root.crt GIT_SSL_CAINFO=$PWD/caddy-root.crt   # trust it in fervo and git
fervo clone https://localhost:8443 ./work
```

`host.docker.internal` reaches the host from Docker Desktop. On Linux, add `--add-host=host.docker.internal:host-gateway` to `docker run` and serve on an address the container can reach.

This recipe was checked with Caddy 2.10: clone, claim with `--checkout`, push and submit through the proxy.

## Other proxies

Any proxy works if it streams request bodies without a size limit and lets a response take at least 30 s. nginx's defaults do neither, so it would need `client_max_body_size 0;`, `proxy_request_buffering off;` and `proxy_read_timeout 60s;`. These nginx settings have not been tested with Fervo.
