# Service Lasso Admin

Operate your local services in a browser: see what is running, start and stop a service, inspect its endpoints, and read the logs that explain a failure.

**[Try Admin with the Service Lasso demo](https://github.com/service-lasso/service-lasso/blob/develop/docs/quick-start.md)**

[UI guide](https://github.com/service-lasso/service-lasso/blob/develop/docs/operator-ui/service-admin-ui-guide.md) · [Configure and recover](https://github.com/service-lasso/service-lasso/blob/develop/docs/operate-your-service.md) · [MCP and agent prompts](https://github.com/service-lasso/service-lasso/blob/develop/docs/agent-prompts.md)

## Develop Admin

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Set `VITE_SERVICE_LASSO_API_BASE_URL` to your runtime URL. The runtime owns authentication and authorization. See [developer notes](docs/development.md) for configuration, validation, packaging, and design provenance.

Reader guides are maintained in [Service Lasso](https://github.com/service-lasso/service-lasso/tree/develop/docs). The offline Help Center bundles generated copies; see [help synchronization](docs/help-sync.md).

MIT · [License](LICENSE)
