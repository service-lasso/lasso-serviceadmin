# Service Lasso Admin

Service Lasso Admin is the browser interface for operating a Service Lasso runtime. It provides the Release 1 dashboard, service lifecycle, dependencies, logs, runtime, MCP, installed services, variables, network, security, settings, and help surfaces.

## Release 1 product boundary

- Fleet is retired.
- Sessions is retired; identity sessions belong to ZITADEL.
- Policy Simulation is not a product surface. Security shows the service manifest secret-access assignments that Core actually enforces.
- Support Bundle is not a GA control and remains hidden until it has released-artifact evidence.
- Capabilities without GA evidence remain hidden or are explicitly labelled preview.

The full decision record and validation contract are in [`docs/release/release-1-product-decisions.md`](docs/release/release-1-product-decisions.md).

## Runtime endpoint contract

Admin discovers the Service Lasso runtime API through configuration rather than a fixed host assumption:

- `VITE_SERVICE_LASSO_API_BASE_URL`
- `VITE_SERVICE_LASSO_FAVORITES_ENABLED`
- `VITE_SERVICE_LASSO_LOGS_DEBUG`

Example:

```text
VITE_SERVICE_LASSO_API_BASE_URL=http://127.0.0.1:3001
VITE_SERVICE_LASSO_FAVORITES_ENABLED=true
```

The runtime is responsible for authentication, authorization, bind identity, and client-visible endpoint policy. Admin must not invent or weaken those controls.

## Local development

```powershell
pnpm install --frozen-lockfile
pnpm run dev
```

Validate the application:

```powershell
pnpm run lint
pnpm run format:check
pnpm run test
pnpm run build
pnpm run package:artifact
pnpm run package:verify
```

## Packaging

The release workflow produces one archive per supported operating system, a CycloneDX SBOM for every archive, a checksum manifest, provenance attestations, and a service manifest. Publication is manual, environment-protected, and bound to the exact reviewed candidate commit.

## Design provenance

The interface is derived from the MIT-licensed `shadcn-admin` project by satnaing. Service Lasso keeps its shared responsive, accessible Shadcn/Tailwind page structure; Service Lasso product behavior, runtime contracts, tests, and release controls are maintained here.

## License

MIT. See [`LICENSE`](LICENSE).
